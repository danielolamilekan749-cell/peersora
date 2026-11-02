import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { DomainError } from "@/lib/server/errors";
import { DB_VERSION, decodeDatabase, diff, emptyDatabase, snapshot, tableSpecs, type Change, type Row } from "@/lib/server/rows";

export { DB_VERSION };

/**
 * Where the platform keeps its data.
 *  - With SUPABASE_SERVICE_ROLE_KEY set (always the case on Vercel) everything
 *    lives in the Supabase database from supabase/migrations.
 *  - Without it, local development falls back to a JSON file so the app still
 *    runs on a laptop. Production never uses the file.
 */
export interface Store {
  load(): Promise<Database>;
  save(db: Database, changes: Change[]): Promise<void>;
}

const PAGE = 1000;
const BATCH = 400;

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  async function readAll(table: string, order: string, keys: string[]) {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = client.from(table).select("*").order(order, { ascending: true });
      for (const key of keys) if (key !== order) query = query.order(key, { ascending: true });
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) throw new Error(`Could not read ${table}: ${error.message}`);
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  }

  /** One database round trip when migration 0006 has been run. Null means "not installed". */
  let bundled: boolean | null = null;

  async function loadBundled() {
    if (bundled === false) return null;
    const { data, error } = await client.rpc("app_read");
    if (error || !data || typeof data !== "object") {
      bundled = false;
      return null;
    }
    bundled = true;
    return decodeDatabase(data as Record<string, Row[]>);
  }

  function fail(table: string, message: string): never {
    throw new DomainError(`Could not save ${table}: ${message}`.slice(0, 220), "db", 500);
  }

  async function upsertRows(table: string, keys: string[], rows: Row[]) {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await client.from(table).upsert(batch, { onConflict: keys.join(",") });
      if (!error) continue;
      // Works even before the unique index from 0003 exists.
      if (!/no unique or exclusion constraint/i.test(error.message)) fail(table, error.message);
      for (const row of batch) {
        const inserted = await client.from(table).insert(row);
        if (!inserted.error) continue;
        if (inserted.error.code !== "23505") fail(table, inserted.error.message);
        const patch = Object.fromEntries(Object.entries(row).filter(([column]) => !keys.includes(column)));
        let update = client.from(table).update(patch);
        for (const key of keys) update = update.eq(key, row[key] as string);
        const updated = await update;
        if (updated.error) fail(table, updated.error.message);
      }
    }
  }

  return {
    async load() {
      const bundledDb = await loadBundled();
      if (bundledDb) return bundledDb;
      const entries = await Promise.all(
        tableSpecs.map(async (spec) => [spec.table, await readAll(spec.table, spec.order, spec.keys)] as const),
      );
      return decodeDatabase(Object.fromEntries(entries));
    },
    async save(_db, changes) {
      // Parents first when adding rows, children first when removing them.
      for (const change of changes) await upsertRows(change.table, change.keys, change.upserts);
      for (const change of [...changes].reverse()) {
        for (const row of change.deletes) {
          let query = client.from(change.table).delete();
          for (const key of change.keys) query = query.eq(key, row[key] as string);
          const { error } = await query;
          if (error) fail(change.table, error.message);
        }
      }
    },
  };
}

const filePath = path.join(process.cwd(), "data", "local-db.json");

function createFileStore(): Store {
  return {
    async load() {
      if (!fs.existsSync(filePath)) return emptyDatabase();
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Database;
      return parsed.version === DB_VERSION ? parsed : emptyDatabase();
    },
    async save(db) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
    },
  };
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export const storageIsSupabase = () => Boolean(supabaseConfig());

let cached: Store | null = null;

function store(): Store {
  if (cached) return cached;
  const config = supabaseConfig();
  if (config) {
    cached = createSupabaseStore(config.url, config.key);
  } else if (process.env.NODE_ENV === "production") {
    throw new DomainError("The server is not fully set up yet: SUPABASE_SERVICE_ROLE_KEY is missing. Open /api/health to see what is missing.", "config", 503);
  } else {
    cached = createFileStore();
  }
  return cached;
}

/** Repeat reads on the same server reuse this for a moment, so a tap does not reload every table. */
const FRESH_MS = 2000;
let generation = 0;
let memory: { db: Database; at: number } | null = null;

function remember(db: Database) {
  memory = { db: structuredClone(db), at: Date.now() };
}

export function readDb(): Promise<Database> {
  const seen = generation;
  if (memory && Date.now() - memory.at < FRESH_MS) return Promise.resolve(structuredClone(memory.db));
  return store().load().then((db) => {
    // A save finished while this read was in flight. Keep the saved copy.
    if (seen !== generation && memory) return structuredClone(memory.db);
    remember(db);
    return structuredClone(db);
  });
}

let chain: Promise<unknown> = Promise.resolve();

/** Loads the data, runs `fn` on it, then saves whatever `fn` changed. */
export function mutate<T>(fn: (db: Database) => T): Promise<T> {
  const run = chain.then(async () => {
    generation += 1;
    const target = store();
    const db = await target.load();
    const before = snapshot(db);
    const result = fn(db);
    await target.save(db, diff(before, db));
    remember(db);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Test hook: swap the storage backend. */
export function useStore(next: Store | null) {
  cached = next;
  memory = null;
  generation += 1;
}
