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

  return {
    async load() {
      const entries = await Promise.all(
        tableSpecs.map(async (spec) => [spec.table, await readAll(spec.table, spec.order, spec.keys)] as const),
      );
      return decodeDatabase(Object.fromEntries(entries));
    },
    async save(_db, changes) {
      // Parents first when adding rows, children first when removing them.
      for (const change of changes) {
        for (let i = 0; i < change.upserts.length; i += BATCH) {
          const { error } = await client
            .from(change.table)
            .upsert(change.upserts.slice(i, i + BATCH), { onConflict: change.keys.join(",") });
          if (error) throw new Error(`Could not save ${change.table}: ${error.message}`);
        }
      }
      for (const change of [...changes].reverse()) {
        for (const row of change.deletes) {
          let query = client.from(change.table).delete();
          for (const key of change.keys) query = query.eq(key, row[key] as string);
          const { error } = await query;
          if (error) throw new Error(`Could not remove from ${change.table}: ${error.message}`);
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

export function readDb(): Promise<Database> {
  return store().load();
}

let chain: Promise<unknown> = Promise.resolve();

/** Loads the data, runs `fn` on it, then saves whatever `fn` changed. */
export function mutate<T>(fn: (db: Database) => T): Promise<T> {
  const run = chain.then(async () => {
    const target = store();
    const db = await target.load();
    const before = snapshot(db);
    const result = fn(db);
    await target.save(db, diff(before, db));
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
}
