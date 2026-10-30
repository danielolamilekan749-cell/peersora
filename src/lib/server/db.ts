import fs from "fs";
import path from "path";
import type { Database } from "@/lib/types";

export const DB_VERSION = 2;

const filePath = path.join(process.cwd(), "data", "local-db.json");

/** A brand-new, empty platform. Everything in it is created by real people. */
export function createSeed(): Database {
  return {
    version: DB_VERSION,
    users: [],
    profiles: [],
    posts: [],
    comments: [],
    likes: [],
    savedProfiles: [],
    savedPosts: [],
    blocks: [],
    orders: [],
    reviews: [],
    reports: [],
    notifications: [],
    audits: [],
    verifications: [],
    appeals: [],
    views: [],
  };
}

export function readDb(): Database {
  if (!fs.existsSync(filePath)) {
    const seeded = createSeed();
    writeDb(seeded);
    return seeded;
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Database;
  if (parsed.version !== DB_VERSION) {
    const seeded = createSeed();
    writeDb(seeded);
    return seeded;
  }
  parsed.orders ??= [];
  return parsed;
}

export function writeDb(db: Database) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
}

let chain: Promise<unknown> = Promise.resolve();

export function mutate<T>(fn: (db: Database) => T): Promise<T> {
  const run = chain.then(() => {
    const db = readDb();
    const result = fn(db);
    writeDb(db);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
