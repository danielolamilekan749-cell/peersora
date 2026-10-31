import type {
  AppealRecord,
  AuditRecord,
  BlockRecord,
  CommentRecord,
  Database,
  LikeRecord,
  NotificationRecord,
  OrderRecord,
  PostRecord,
  ProfileRecord,
  ReportRecord,
  ReviewRecord,
  SaveRecord,
  UserRecord,
  VerificationRecord,
  ViewRecord,
} from "@/lib/types";

/**
 * Maps the app's records to the tables in supabase/migrations and back.
 * The server loads the rows, runs the same business rules as before, then
 * saves only the rows that changed.
 */
export type Row = Record<string, unknown>;

export type TableSpec = {
  table: string;
  /** Columns that identify a row. Used for upserts and deletes. */
  keys: string[];
  /** Column used for a stable order when reading. */
  order: string;
  rows: (db: Database) => Row[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const tableSpecs: TableSpec[] = [
  {
    table: "accounts",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.users.map((u) => ({
        id: u.id,
        role: u.role,
        email: u.email,
        full_name: u.fullName,
        avatar_url: u.avatar ?? "",
        provider: u.provider ?? "google",
        phone: u.phone,
        status: u.status,
        deactivated: u.deactivated,
        age_confirmed_at: u.createdAt,
        terms_accepted_at: u.createdAt,
        notification_prefs: u.notificationPrefs,
        last_active_at: u.lastActiveAt,
        created_at: u.createdAt,
      })),
  },
  {
    table: "profiles",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.profiles.map((p) => ({
        id: p.id,
        user_id: p.userId,
        username: p.username,
        display_name: p.displayName,
        bio: p.bio,
        interests: p.interests,
        avatar_url: p.avatar,
        cover_url: p.cover,
        city: p.city,
        region: p.region,
        country: p.country,
        location_privacy: p.locationPrivacy,
        date_of_birth: p.dateOfBirth || null,
        age_verified: p.ageVerified,
        identity_verified: p.identityVerified,
        visibility: p.visibility,
        discoverable: p.discoverable,
        featured: p.featured,
        is_sample: false,
        created_at: p.joinedAt,
      })),
  },
  {
    table: "posts",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.posts.map((p) => ({
        id: p.id,
        profile_id: p.profileId,
        caption: p.caption,
        frame: p.frame,
        visibility: p.visibility,
        is_sample: false,
        created_at: p.createdAt,
      })),
  },
  {
    table: "post_images",
    keys: ["post_id", "position"],
    order: "position",
    rows: (db) => db.posts.flatMap((p) => p.images.map((url, position) => ({ post_id: p.id, position, url }))),
  },
  {
    table: "comments",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.comments.map((c) => ({
        id: c.id,
        post_id: c.postId,
        author_id: c.authorId,
        body: c.body,
        hidden: c.hidden,
        created_at: c.createdAt,
      })),
  },
  {
    table: "likes",
    keys: ["user_id", "post_id"],
    order: "created_at",
    rows: (db) => db.likes.map((l) => ({ user_id: l.userId, post_id: l.postId, created_at: l.createdAt })),
  },
  {
    table: "saved_posts",
    keys: ["user_id", "post_id"],
    order: "created_at",
    rows: (db) => db.savedPosts.map((s) => ({ user_id: s.userId, post_id: s.targetId, created_at: s.createdAt })),
  },
  {
    table: "saved_profiles",
    keys: ["user_id", "profile_id"],
    order: "created_at",
    rows: (db) => db.savedProfiles.map((s) => ({ user_id: s.userId, profile_id: s.targetId, created_at: s.createdAt })),
  },
  {
    table: "blocks",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.blocks.map((b) => ({
        id: b.id,
        owner_id: b.ownerId,
        profile_id: b.profileId,
        blocked_user_id: b.userId,
        created_at: b.createdAt,
      })),
  },
  {
    table: "orders",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.orders.map((o) => ({
        id: o.id,
        user_id: o.userId,
        profile_id: o.profileId,
        note: o.note,
        status: o.status,
        created_at: o.createdAt,
        updated_at: o.updatedAt,
      })),
  },
  {
    table: "reviews",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.reviews.map((r) => ({
        id: r.id,
        profile_id: r.profileId,
        author_id: r.authorId,
        rating: r.rating,
        body: r.body,
        status: r.status,
        created_at: r.createdAt,
      })),
  },
  {
    table: "reports",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.reports.map((r) => ({
        id: r.id,
        reporter_id: r.reporterId,
        target_type: r.targetType,
        target_id: r.targetId,
        reason: r.reason,
        details: r.details,
        status: r.status,
        created_at: r.createdAt,
      })),
  },
  {
    table: "notifications",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.notifications.map((n) => ({
        id: n.id,
        user_id: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.href,
        read: n.read,
        created_at: n.createdAt,
      })),
  },
  {
    table: "verifications",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.verifications.map((v) => ({
        id: v.id,
        user_id: v.userId,
        profile_id: v.profileId,
        status: v.status,
        note: v.note,
        created_at: v.createdAt,
        updated_at: v.updatedAt,
      })),
  },
  {
    table: "appeals",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.appeals.map((a) => ({ id: a.id, user_id: a.userId, message: a.message, status: a.status, created_at: a.createdAt })),
  },
  {
    table: "profile_views",
    keys: ["profile_id", "viewer_key", "day"],
    order: "day",
    rows: (db) => db.views.map((v) => ({ profile_id: v.profileId, viewer_key: v.viewerKey, day: v.day })),
  },
  {
    table: "audit_logs",
    keys: ["id"],
    order: "created_at",
    rows: (db) =>
      db.audits.map((a) => ({
        id: a.id,
        actor_id: UUID.test(a.actorId) ? a.actorId : null,
        action: a.action,
        target_type: a.targetType,
        target_id: a.targetId,
        meta: a.meta,
        created_at: a.createdAt,
      })),
  },
];

/** Tables whose rows are new-first in the app. */
const NEWEST_FIRST = new Set(["posts", "reviews", "reports", "notifications", "appeals", "audit_logs", "orders"]);

export const DB_VERSION = 2;

export function emptyDatabase(): Database {
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

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const bool = (value: unknown) => value === true;
const stamp = (value: unknown) => {
  const date = new Date(typeof value === "string" || typeof value === "number" ? value : Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};
const orNull = (value: unknown) => (typeof value === "string" ? value : null);

/** Rebuilds the app's database object from the rows read out of Supabase. */
export function decodeDatabase(tables: Record<string, Row[]>): Database {
  const db = emptyDatabase();
  const get = (name: string) => {
    const rows = tables[name] ?? [];
    return NEWEST_FIRST.has(name) ? [...rows].reverse() : rows;
  };

  db.users = get("accounts").map(
    (r): UserRecord => ({
      id: text(r.id),
      email: text(r.email).toLowerCase(),
      passwordHash: "",
      passwordSalt: "",
      role: r.role as UserRecord["role"],
      fullName: text(r.full_name),
      phone: text(r.phone),
      status: r.status as UserRecord["status"],
      provider: r.provider === "password" ? "password" : "google",
      avatar: text(r.avatar_url),
      deactivated: bool(r.deactivated),
      createdAt: stamp(r.created_at),
      lastActiveAt: stamp(r.last_active_at),
      notificationPrefs: {
        likes: true,
        comments: true,
        orders: true,
        announcements: true,
        verification: true,
        ...((r.notification_prefs as object) ?? {}),
      },
    }),
  );
  const seen = new Map(db.users.map((u) => [u.id, u.lastActiveAt]));

  db.profiles = get("profiles").map(
    (r): ProfileRecord => ({
      id: text(r.id),
      userId: orNull(r.user_id),
      username: text(r.username),
      displayName: text(r.display_name),
      bio: text(r.bio),
      interests: Array.isArray(r.interests) ? (r.interests as string[]) : [],
      avatar: text(r.avatar_url),
      cover: text(r.cover_url),
      city: text(r.city),
      region: text(r.region),
      country: text(r.country),
      locationPrivacy: r.location_privacy as ProfileRecord["locationPrivacy"],
      dateOfBirth: text(r.date_of_birth),
      ageVerified: bool(r.age_verified),
      identityVerified: bool(r.identity_verified),
      visibility: r.visibility as ProfileRecord["visibility"],
      discoverable: bool(r.discoverable),
      featured: bool(r.featured),
      presenceHint: null,
      joinedAt: stamp(r.created_at),
      lastActiveAt: seen.get(text(r.user_id)) ?? stamp(r.created_at),
    }),
  );

  const images = new Map<string, { position: number; url: string }[]>();
  for (const r of tables.post_images ?? []) {
    const list = images.get(text(r.post_id)) ?? [];
    list.push({ position: Number(r.position), url: text(r.url) });
    images.set(text(r.post_id), list);
  }
  db.posts = get("posts").map(
    (r): PostRecord => ({
      id: text(r.id),
      profileId: text(r.profile_id),
      images: (images.get(text(r.id)) ?? []).sort((a, b) => a.position - b.position).map((item) => item.url),
      caption: text(r.caption),
      createdAt: stamp(r.created_at),
      visibility: r.visibility as PostRecord["visibility"],
      frame: r.frame as PostRecord["frame"],
    }),
  );

  db.comments = get("comments").map(
    (r): CommentRecord => ({
      id: text(r.id),
      postId: text(r.post_id),
      authorId: text(r.author_id),
      body: text(r.body),
      createdAt: stamp(r.created_at),
      hidden: bool(r.hidden),
    }),
  );
  db.likes = get("likes").map((r): LikeRecord => ({ userId: text(r.user_id), postId: text(r.post_id), createdAt: stamp(r.created_at) }));
  db.savedPosts = get("saved_posts").map((r): SaveRecord => ({ userId: text(r.user_id), targetId: text(r.post_id), createdAt: stamp(r.created_at) }));
  db.savedProfiles = get("saved_profiles").map((r): SaveRecord => ({ userId: text(r.user_id), targetId: text(r.profile_id), createdAt: stamp(r.created_at) }));
  db.blocks = get("blocks").map(
    (r): BlockRecord => ({
      id: text(r.id),
      ownerId: text(r.owner_id),
      profileId: orNull(r.profile_id),
      userId: orNull(r.blocked_user_id),
      createdAt: stamp(r.created_at),
    }),
  );
  db.orders = get("orders").map(
    (r): OrderRecord => ({
      id: text(r.id),
      userId: text(r.user_id),
      profileId: text(r.profile_id),
      note: text(r.note),
      status: r.status as OrderRecord["status"],
      createdAt: stamp(r.created_at),
      updatedAt: stamp(r.updated_at),
    }),
  );
  db.reviews = get("reviews").map(
    (r): ReviewRecord => ({
      id: text(r.id),
      profileId: text(r.profile_id),
      authorId: text(r.author_id),
      rating: Number(r.rating),
      body: text(r.body),
      status: r.status as ReviewRecord["status"],
      createdAt: stamp(r.created_at),
    }),
  );
  db.reports = get("reports").map(
    (r): ReportRecord => ({
      id: text(r.id),
      reporterId: text(r.reporter_id),
      targetType: r.target_type as ReportRecord["targetType"],
      targetId: text(r.target_id),
      reason: text(r.reason),
      details: text(r.details),
      status: r.status as ReportRecord["status"],
      createdAt: stamp(r.created_at),
    }),
  );
  db.notifications = get("notifications").map(
    (r): NotificationRecord => ({
      id: text(r.id),
      userId: text(r.user_id),
      type: text(r.type),
      title: text(r.title),
      body: text(r.body),
      href: orNull(r.href),
      read: bool(r.read),
      createdAt: stamp(r.created_at),
    }),
  );
  db.verifications = get("verifications").map(
    (r): VerificationRecord => ({
      id: text(r.id),
      userId: text(r.user_id),
      profileId: text(r.profile_id),
      status: r.status as VerificationRecord["status"],
      note: text(r.note),
      createdAt: stamp(r.created_at),
      updatedAt: stamp(r.updated_at),
    }),
  );
  db.appeals = get("appeals").map(
    (r): AppealRecord => ({
      id: text(r.id),
      userId: text(r.user_id),
      message: text(r.message),
      status: r.status as AppealRecord["status"],
      createdAt: stamp(r.created_at),
    }),
  );
  db.views = get("profile_views").map((r): ViewRecord => ({ profileId: text(r.profile_id), viewerKey: text(r.viewer_key), day: text(r.day) }));
  db.audits = get("audit_logs").map(
    (r): AuditRecord => ({
      id: text(r.id),
      actorId: text(r.actor_id, "system") || "system",
      action: text(r.action),
      targetType: text(r.target_type),
      targetId: text(r.target_id),
      meta: text(r.meta),
      createdAt: stamp(r.created_at),
    }),
  );
  return db;
}

export type Snapshot = Map<string, Map<string, string>>;

const keyOf = (row: Row, keys: string[]) => keys.map((key) => String(row[key])).join("|");

/** Fingerprints every row so we can tell what a request changed. */
export function snapshot(db: Database): Snapshot {
  const result: Snapshot = new Map();
  for (const spec of tableSpecs) {
    const rows = new Map<string, string>();
    for (const row of spec.rows(db)) rows.set(keyOf(row, spec.keys), JSON.stringify(row));
    result.set(spec.table, rows);
  }
  return result;
}

export type Change = { table: string; keys: string[]; upserts: Row[]; deletes: Row[] };

/** Rows that are new or edited, and rows that were removed. */
export function diff(before: Snapshot, db: Database): Change[] {
  const changes: Change[] = [];
  for (const spec of tableSpecs) {
    const old = before.get(spec.table) ?? new Map<string, string>();
    const upserts: Row[] = [];
    const seen = new Set<string>();
    for (const row of spec.rows(db)) {
      const key = keyOf(row, spec.keys);
      seen.add(key);
      if (old.get(key) !== JSON.stringify(row)) upserts.push(row);
    }
    const deletes: Row[] = [];
    for (const [key, raw] of old) {
      if (seen.has(key)) continue;
      const row = JSON.parse(raw) as Row;
      deletes.push(Object.fromEntries(spec.keys.map((column) => [column, row[column]])));
    }
    if (upserts.length || deletes.length) changes.push({ table: spec.table, keys: spec.keys, upserts, deletes });
  }
  return changes;
}
