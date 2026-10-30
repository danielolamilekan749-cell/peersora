import fs from "fs";
import path from "path";
import { DEMO_PASSWORD } from "@/lib/constants";
import { SEED_POSTS, SEED_PROFILES } from "@/lib/catalog";
import type { Database, NotificationPrefs, UserRecord } from "@/lib/types";
import { hashPassword } from "@/lib/server/auth";

export const DB_VERSION = 1;

const filePath = path.join(process.cwd(), "data", "local-db.json");

const defaultPrefs: NotificationPrefs = {
  followers: true,
  likes: true,
  comments: true,
  orders: true,
  announcements: true,
  verification: true,
};

function user(
  id: string,
  email: string,
  role: UserRecord["role"],
  fullName: string,
  password: { hash: string; salt: string },
): UserRecord {
  return {
    id,
    email,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    role,
    fullName,
    phone: "",
    status: "active",
    deactivated: false,
    createdAt: "2026-01-10T10:00:00.000Z",
    lastActiveAt: "2026-10-29T16:00:00.000Z",
    notificationPrefs: { ...defaultPrefs },
  };
}

export function createSeed(): Database {
  const password = hashPassword(DEMO_PASSWORD);
  return {
    version: DB_VERSION,
    users: [
      user("user-admin", "admin@daylight.demo", "admin", "Daylight Admin", password),
      user("user-james", "james@daylight.demo", "member", "James Adeyemi", password),
      user("user-amara", "amara@daylight.demo", "creator", "Amara Okonkwo", password),
      user("user-nora", "nora@daylight.demo", "creator", "Nora Bennett", password),
    ],
    profiles: SEED_PROFILES.map((profile) => ({ ...profile, interests: [...profile.interests] })),
    posts: SEED_POSTS.map((post) => ({ ...post, images: [...post.images] })),
    comments: [],
    follows: [],
    likes: [],
    savedProfiles: [],
    savedPosts: [],
    blocks: [],
    orders: [],
    reviews: [],
    reports: [],
    notifications: [
      {
        id: "note-nora-welcome",
        userId: "user-nora",
        type: "verification",
        title: "Profile waiting for review",
        body: "Your profile stays private until age and identity checks are approved.",
        href: "/dashboard",
        read: false,
        createdAt: "2026-10-28T10:05:00.000Z",
      },
    ],
    audits: [
      {
        id: "audit-seed",
        actorId: "system",
        action: "seed",
        targetType: "platform",
        targetId: "daylight",
        meta: "Sample directory created for local preview.",
        createdAt: "2026-01-10T10:00:00.000Z",
      },
    ],
    verifications: [
      {
        id: "verify-amara",
        userId: "user-amara",
        profileId: "profile-amara",
        status: "approved",
        note: "Sample creator approved for the demo.",
        createdAt: "2025-11-02T10:00:00.000Z",
        updatedAt: "2025-11-02T12:00:00.000Z",
      },
      {
        id: "verify-nora",
        userId: "user-nora",
        profileId: "profile-nora",
        status: "pending",
        note: "",
        createdAt: "2026-10-28T10:00:00.000Z",
        updatedAt: "2026-10-28T10:00:00.000Z",
      },
    ],
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
