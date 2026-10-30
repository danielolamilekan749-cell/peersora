import { SEED_POSTS, SEED_PROFILES } from "@/lib/catalog";
import { presentPost, presentProfile } from "@/lib/present";
import type { Database, NotificationPrefs, UserRecord } from "@/lib/types";

const prefs: NotificationPrefs = {
  followers: true,
  likes: true,
  comments: true,
  orders: true,
  announcements: true,
  verification: true,
};

function stub(id: string): UserRecord {
  return {
    id,
    email: "",
    passwordHash: "",
    passwordSalt: "",
    role: "creator",
    fullName: "",
    phone: "",
    status: "active",
    deactivated: false,
    createdAt: "",
    lastActiveAt: "",
    notificationPrefs: prefs,
  };
}

const PREVIEW_NOW = Date.parse("2026-10-29T18:00:00.000Z");

export function previewFeed() {
  const db = {
    version: 1,
    users: [stub("user-amara")],
    profiles: SEED_PROFILES,
    posts: SEED_POSTS,
    comments: [],
    follows: [],
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
  } satisfies Database;
  const profiles = SEED_PROFILES.filter((profile) => profile.discoverable && profile.ageVerified).map((profile) =>
    presentProfile(db, profile, PREVIEW_NOW),
  );
  const ids = new Set(profiles.map((profile) => profile.id));
  const posts = SEED_POSTS.filter((post) => post.visibility === "public" && ids.has(post.profileId)).map((post) =>
    presentPost(db, post),
  );
  return { profiles, posts };
}
