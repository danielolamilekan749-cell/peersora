import { randomUUID } from "crypto";
import { INTERESTS, RESERVED_USERNAMES } from "@/lib/constants";
import { ageFromDob } from "@/lib/format";
import {
  isPubliclyListed,
  presentComments,
  presentPost,
  presentProfile,
  presentReviews,
} from "@/lib/present";
import type {
  Database,
  NotificationPrefs,
  OrderRecord,
  PostRecord,
  ProfileRecord,
  UserRecord,
  PublicOrder,
  GivenRating,
  ViewerState,
} from "@/lib/types";
import { hashPassword, verifyPassword } from "@/lib/server/auth";
import { DomainError } from "@/lib/server/errors";

export type Actor = {
  user: UserRecord | null;
  guestId: string | null;
  actorId: string;
};

const now = () => new Date().toISOString();

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requireUser(db: Database, actor: Actor) {
  if (!actor.user) throw new DomainError("Sign in to continue.", "auth_required", 401);
  const user = db.users.find((item) => item.id === actor.user?.id && item.status === "active");
  if (!user) throw new DomainError("Sign in to continue.", "auth_required", 401);
  return user;
}

function creatorProfile(db: Database, user: UserRecord) {
  const profile = db.profiles.find((item) => item.userId === user.id);
  if (!profile || user.role !== "creator") {
    throw new DomainError("A creator profile is required.", "forbidden", 403);
  }
  return profile;
}

function emailOf(value: unknown) {
  const email = text(value, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError("Enter a valid email address.");
  }
  return email;
}

function assertPassword(password: string) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new DomainError("Use at least 8 characters with a letter and a number.");
  }
}

function assertImage(url: string) {
  if (!url) return "";
  if (
    url.startsWith("/uploads/") ||
    url.startsWith("https://images.unsplash.com/") ||
    url.startsWith("https://res.cloudinary.com/")
  ) {
    return url;
  }
  throw new DomainError("Use a photo uploaded to Daylight.");
}

function claimGuest(db: Database, guestId: string | null, userId: string) {
  if (!guestId) return;
  for (const block of db.blocks) {
    if (block.ownerId === guestId) block.ownerId = userId;
  }
  for (const report of db.reports) {
    if (report.reporterId === guestId) report.reporterId = userId;
  }
}

function notify(
  db: Database,
  userId: string | null | undefined,
  type: keyof NotificationPrefs | string,
  title: string,
  body: string,
  href: string | null,
) {
  if (!userId) return;
  const user = db.users.find((item) => item.id === userId);
  if (!user || user.status !== "active") return;
  const prefs = user.notificationPrefs;
  if (type in prefs && prefs[type as keyof NotificationPrefs] === false) return;
  db.notifications.unshift({
    id: randomUUID(),
    userId,
    type,
    title,
    body,
    href,
    read: false,
    createdAt: now(),
  });
}

function audit(db: Database, actorId: string, action: string, targetType: string, targetId: string, meta = "") {
  db.audits.unshift({
    id: randomUUID(),
    actorId,
    action,
    targetType,
    targetId,
    meta,
    createdAt: now(),
  });
}

export function buildViewer(db: Database, actor: Actor): ViewerState {
  const blocks = db.blocks
    .filter((block) => block.ownerId === actor.actorId && block.profileId)
    .map((block) => block.profileId as string);
  if (!actor.user) {
    return {
      id: actor.actorId,
      role: "guest",
      email: null,
      fullName: null,
      username: null,
      profileId: null,
      follows: [],
      savedProfiles: [],
      savedPosts: [],
      likes: [],
      blocks,
    };
  }
  const profile = db.profiles.find((item) => item.userId === actor.user?.id);
  return {
    id: actor.user.id,
    role: actor.user.role,
    email: actor.user.email,
    fullName: actor.user.fullName,
    username: profile?.username ?? null,
    profileId: profile?.id ?? null,
    follows: db.follows.filter((follow) => follow.userId === actor.user?.id).map((follow) => follow.profileId),
    savedProfiles: db.savedProfiles
      .filter((save) => save.userId === actor.user?.id)
      .map((save) => save.targetId),
    savedPosts: db.savedPosts.filter((save) => save.userId === actor.user?.id).map((save) => save.targetId),
    likes: db.likes.filter((like) => like.userId === actor.user?.id).map((like) => like.postId),
    blocks,
  };
}

function hiddenFrom(db: Database, actor: Actor, profile: ProfileRecord) {
  if (db.blocks.some((block) => block.ownerId === actor.actorId && block.profileId === profile.id)) {
    return true;
  }
  if (
    profile.userId &&
    db.blocks.some((block) => block.ownerId === profile.userId && block.userId === actor.actorId)
  ) {
    return true;
  }
  return false;
}

function listedProfiles(db: Database, actor: Actor) {
  return db.profiles.filter((profile) => {
    const owner = profile.userId ? db.users.find((user) => user.id === profile.userId) : undefined;
    if (owner?.deactivated) return false;
    if (!isPubliclyListed(profile, owner?.status)) return false;
    if (hiddenFrom(db, actor, profile)) return false;
    return true;
  });
}

export function directory(db: Database, actor: Actor) {
  const profiles = listedProfiles(db, actor).map((profile) => presentProfile(db, profile));
  const ids = new Set(profiles.map((profile) => profile.id));
  const posts = db.posts
    .filter((post) => post.visibility === "public" && ids.has(post.profileId))
    .map((post) => presentPost(db, post))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return { profiles, posts, viewer: buildViewer(db, actor) };
}

export function usernameStatus(db: Database, raw: string) {
  const username = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { available: false, reason: "Use 3–20 letters, numbers, or underscores." };
  }
  if (RESERVED_USERNAMES.has(username) || db.profiles.some((profile) => profile.username === username)) {
    return { available: false, reason: "That username is not available." };
  }
  return { available: true, reason: "" };
}

function uniqueUsername(db: Database, seed: string) {
  const root = seed.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14) || "hook";
  let candidate = root.length >= 3 ? root : `${root}${randomUUID().slice(0, 4)}`;
  while (!usernameStatus(db, candidate).available) {
    candidate = `${root}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return candidate;
}

function newUser(email: string, fullName: string, role: UserRecord["role"], provider: "password" | "google", avatar = ""): UserRecord {
  const hashed = hashPassword(randomUUID());
  return {
    id: randomUUID(),
    email,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    role,
    fullName,
    phone: "",
    status: "active",
    provider,
    avatar,
    deactivated: false,
    createdAt: now(),
    lastActiveAt: now(),
    notificationPrefs: {
      followers: true,
      likes: true,
      comments: true,
      orders: true,
      announcements: true,
      verification: true,
    },
  };
}

/**
 * Google sign-in. In production this is replaced by Supabase Auth
 * (supabase.auth.signInWithOAuth({ provider: "google" })); the account shape
 * created here matches the handle_new_user() trigger in the SQL schema.
 */
export function googleSignIn(db: Database, input: Record<string, unknown>, guestId: string | null) {
  const result = googleSignInInner(db, input, guestId);
  // Owners listed in ADMIN_EMAILS (comma separated) become admins when they sign in with Google.
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(result.user.email) && result.user.role !== "admin") result.user.role = "admin";
  return result;
}

function googleSignInInner(db: Database, input: Record<string, unknown>, guestId: string | null) {
  const email = emailOf(input.email);
  const fullName = text(input.name, 80);
  const intent = input.intent === "hook" ? "creator" : "member";
  const existing = db.users.find((item) => item.email === email && item.status !== "deleted");
  if (existing) {
    if (existing.status === "suspended") {
      throw new DomainError("This account is suspended. You can submit an appeal from the sign in page.", "suspended", 403);
    }
    if (intent === "creator" && existing.role === "member") {
      const busy =
        db.orders.some((order) => order.userId === existing.id) ||
        db.reviews.some((review) => review.authorId === existing.id);
      if (busy) {
        throw new DomainError("This Google account is already a user account. Use a different Google account to join as a hook.", "role", 409);
      }
      existing.role = "creator";
    }
    existing.lastActiveAt = now();
    claimGuest(db, guestId, existing.id);
    return { user: existing, created: false };
  }
  if (input.adult !== true) throw new DomainError("Confirm that you are 18 or over to continue.", "age", 400);
  if (fullName.length < 2) throw new DomainError("Enter the name on your Google account.");
  const user = newUser(email, fullName, intent, "google");
  db.users.push(user);
  claimGuest(db, guestId, user.id);
  notify(
    db,
    user.id,
    "announcements",
    "Welcome to Daylight",
    intent === "creator" ? "Add a profile photo and your location to finish your hook profile." : "Your account is ready. Save posts and order from profiles you like.",
    intent === "creator" ? "/join?as=hook" : "/",
  );
  audit(db, user.id, "google-signup", "user", user.id, intent);
  return { user, created: true };
}

/** Step 2 and 3 of the hook flow: profile photo, then location. */
export function completeHookProfile(db: Database, actor: Actor, input: Record<string, unknown>) {
  const user = requireUser(db, actor);
  if (user.role !== "creator") throw new DomainError("Only hook accounts have a public profile.", "forbidden", 403);
  const existing = db.profiles.find((item) => item.userId === user.id);
  const avatar = assertImage(text(input.avatar, 300));
  // One free-text location, for example "Lekki, Lagos, Nigeria".
  const location = text(input.location, 80);
  const phone = text(input.phone, 24);
  if (!avatar) throw new DomainError("Upload a profile photo.");
  if (location.length < 2) throw new DomainError("Enter your location.");
  if (!/^\+?[0-9][0-9 ()-]{6,19}$/.test(phone) || phone.replace(/\D/g, "").length < 7) {
    throw new DomainError("Enter a valid phone number, for example +234 801 234 5678.");
  }
  const city = location;
  const country = "";
  const privacy = "city" as const;
  user.phone = phone;
  if (existing) {
    existing.avatar = avatar;
    existing.city = city;
    existing.region = city;
    existing.country = country;
    existing.locationPrivacy = privacy;
    return existing;
  }
  const profile: ProfileRecord = {
    id: randomUUID(),
    userId: user.id,
    username: uniqueUsername(db, user.fullName.split(/\s+/)[0] || user.email.split("@")[0]),
    displayName: user.fullName,
    bio: "",
    interests: [],
    avatar,
    cover: "",
    city,
    region: city,
    country,
    locationPrivacy: privacy,
    dateOfBirth: "",
    ageVerified: false,
    identityVerified: false,
    visibility: "hidden",
    discoverable: false,
    featured: false,
    sample: false,
    presenceHint: null,
    joinedAt: now(),
    lastActiveAt: now(),
  };
  db.profiles.push(profile);
  db.verifications.push({
    id: randomUUID(),
    userId: user.id,
    profileId: profile.id,
    status: "pending",
    note: "",
    createdAt: now(),
    updatedAt: now(),
  });
  notify(
    db,
    user.id,
    "verification",
    "Profile saved privately",
    "Your profile becomes discoverable after age and identity verification is approved. You can start posting now.",
    "/dashboard",
  );
  audit(db, user.id, "hook-profile", "profile", profile.id);
  return profile;
}

export function login(db: Database, emailRaw: unknown, passwordRaw: unknown, guestId: string | null) {
  const email = text(emailRaw, 120).toLowerCase();
  const password = text(passwordRaw, 80);
  const user = db.users.find((item) => item.email === email && item.status !== "deleted");
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    throw new DomainError("Those details do not match an account.", "auth", 401);
  }
  if (user.status === "suspended") {
    throw new DomainError(
      "This account is suspended. You can submit an appeal from this page.",
      "suspended",
      403,
    );
  }
  user.lastActiveAt = now();
  const profile = db.profiles.find((item) => item.userId === user.id);
  if (profile) profile.lastActiveAt = user.lastActiveAt;
  claimGuest(db, guestId, user.id);
  return user;
}

export function submitAppeal(db: Database, input: Record<string, unknown>) {
  const email = text(input.email, 120).toLowerCase();
  const password = text(input.password, 80);
  const message = text(input.message, 800);
  const user = db.users.find((item) => item.email === email);
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    throw new DomainError("Those details do not match an account.", "auth", 401);
  }
  if (user.status !== "suspended") throw new DomainError("This account is not suspended.");
  if (message.length < 20) throw new DomainError("Describe your appeal in at least 20 characters.");
  if (db.appeals.some((appeal) => appeal.userId === user.id && appeal.status === "open")) {
    throw new DomainError("An appeal is already waiting for review.");
  }
  db.appeals.unshift({
    id: randomUUID(),
    userId: user.id,
    message,
    status: "open",
    createdAt: now(),
  });
  audit(db, user.id, "appeal", "user", user.id);
}

export function openProfile(db: Database, actor: Actor, username: string) {
  const profile = db.profiles.find((item) => item.username === username.toLowerCase());
  if (!profile) throw new DomainError("That profile is not available.", "missing", 404);
  const owner = profile.userId ? db.users.find((user) => user.id === profile.userId) : undefined;
  const isOwner = actor.user?.id === profile.userId;
  const isAdmin = actor.user?.role === "admin";
  if (!isOwner && !isAdmin) {
    if (owner?.deactivated || !isPubliclyListed(profile, owner?.status) || hiddenFrom(db, actor, profile)) {
      throw new DomainError("That profile is not available.", "missing", 404);
    }
    const day = now().slice(0, 10);
    if (!db.views.some((view) => view.profileId === profile.id && view.viewerKey === actor.actorId && view.day === day)) {
      db.views.push({ profileId: profile.id, viewerKey: actor.actorId, day });
    }
  }
  const posts = db.posts
    .filter((post) => post.profileId === profile.id && (post.visibility === "public" || isOwner || isAdmin))
    .map((post) => presentPost(db, post))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const accepted = db.orders.some(
    (order) =>
      order.profileId === profile.id &&
      order.userId === actor.user?.id &&
      (order.status === "accepted" || order.status === "completed"),
  );
  const alreadyReviewed = db.reviews.some(
    (review) =>
      review.profileId === profile.id &&
      review.authorId === actor.user?.id &&
      review.status !== "removed",
  );
  return {
    profile: presentProfile(db, profile),
    posts,
    reviews: presentReviews(db, profile.id),
    canReview: Boolean(actor.user?.role === "member" && accepted && !alreadyReviewed),
    viewer: buildViewer(db, actor),
  };
}

export function openPost(db: Database, actor: Actor, id: string) {
  const post = db.posts.find((item) => item.id === id);
  if (!post) throw new DomainError("That post is not available.", "missing", 404);
  const profile = db.profiles.find((item) => item.id === post.profileId);
  if (!profile) throw new DomainError("That post is not available.", "missing", 404);
  const isOwner = actor.user?.id === profile.userId;
  const owner = profile.userId ? db.users.find((user) => user.id === profile.userId) : undefined;
  if (!isOwner && (post.visibility !== "public" || !isPubliclyListed(profile, owner?.status))) {
    throw new DomainError("That post is not available.", "missing", 404);
  }
  if (!isOwner && hiddenFrom(db, actor, profile)) {
    throw new DomainError("That post is not available.", "missing", 404);
  }
  return {
    post: presentPost(db, post),
    comments: presentComments(db, post.id),
    profile: presentProfile(db, profile),
    viewer: buildViewer(db, actor),
  };
}

function findProfile(db: Database, profileId: string) {
  const profile = db.profiles.find((item) => item.id === profileId);
  if (!profile) throw new DomainError("That profile is not available.", "missing", 404);
  return profile;
}

export function toggleFollow(db: Database, actor: Actor, profileId: string, on: boolean) {
  const user = requireUser(db, actor);
  const profile = findProfile(db, profileId);
  if (profile.userId === user.id) throw new DomainError("You cannot follow your own profile.");
  db.follows = db.follows.filter((follow) => !(follow.userId === user.id && follow.profileId === profileId));
  if (on) {
    db.follows.push({ userId: user.id, profileId, createdAt: now() });
    notify(db, profile.userId, "followers", "New follower", `${user.fullName} followed you.`, `/profile/${profile.username}`);
  }
}

export function toggleSave(db: Database, actor: Actor, kind: "profile" | "post", targetId: string, on: boolean) {
  const user = requireUser(db, actor);
  const key = kind === "profile" ? "savedProfiles" : "savedPosts";
  db[key] = db[key].filter((save) => !(save.userId === user.id && save.targetId === targetId));
  if (on) db[key].push({ userId: user.id, targetId, createdAt: now() });
}

export function toggleLike(db: Database, actor: Actor, postId: string, on: boolean) {
  const user = requireUser(db, actor);
  const post = db.posts.find((item) => item.id === postId);
  if (!post) throw new DomainError("That post is not available.", "missing", 404);
  db.likes = db.likes.filter((like) => !(like.userId === user.id && like.postId === postId));
  if (on) {
    db.likes.push({ userId: user.id, postId, createdAt: now() });
    const profile = db.profiles.find((item) => item.id === post.profileId);
    if (profile && profile.userId !== user.id) {
      notify(db, profile.userId, "likes", "New like", `${user.fullName} liked your post.`, `/posts/${post.id}`);
    }
  }
}

export function addComment(db: Database, actor: Actor, postId: string, raw: unknown) {
  const user = requireUser(db, actor);
  const body = text(raw, 500);
  if (body.length < 1) throw new DomainError("Write a comment first.");
  const post = db.posts.find((item) => item.id === postId && item.visibility === "public");
  if (!post) throw new DomainError("That post is not available.", "missing", 404);
  const profile = findProfile(db, post.profileId);
  if (hiddenFrom(db, actor, profile)) throw new DomainError("That post is not available.", "missing", 404);
  db.comments.push({
    id: randomUUID(),
    postId,
    authorId: user.id,
    body,
    createdAt: now(),
    hidden: false,
  });
  if (profile.userId !== user.id) {
    notify(db, profile.userId, "comments", "New comment", `${user.fullName} commented on your post.`, `/posts/${post.id}`);
  }
}

export function setCommentHidden(db: Database, actor: Actor, commentId: string, hidden: boolean) {
  const user = requireUser(db, actor);
  const comment = db.comments.find((item) => item.id === commentId);
  if (!comment) throw new DomainError("Comment not found.", "missing", 404);
  const post = db.posts.find((item) => item.id === comment.postId);
  const profile = post ? db.profiles.find((item) => item.id === post.profileId) : undefined;
  if (!profile || profile.userId !== user.id) throw new DomainError("You can manage comments on your own posts.", "forbidden", 403);
  comment.hidden = hidden;
}

export function blockProfile(db: Database, actor: Actor, profileId: string) {
  requireUser(db, actor);
  const profile = findProfile(db, profileId);
  if (profile.userId && profile.userId === actor.user?.id) throw new DomainError("You cannot block yourself.");
  db.blocks = db.blocks.filter((block) => !(block.ownerId === actor.actorId && block.profileId === profileId));
  db.blocks.push({
    id: randomUUID(),
    ownerId: actor.actorId,
    profileId,
    userId: profile.userId,
    createdAt: now(),
  });
}

export function unblock(db: Database, actor: Actor, blockId: string) {
  const user = requireUser(db, actor);
  db.blocks = db.blocks.filter((block) => !(block.id === blockId && block.ownerId === user.id));
}

export function reportContent(db: Database, actor: Actor, input: Record<string, unknown>) {
  requireUser(db, actor);
  const reason = text(input.reason, 80);
  const details = text(input.details, 500);
  const targetType = text(input.targetType, 20);
  const targetId = text(input.targetId, 80);
  const allowed = ["profile", "post", "comment", "review"];
  if (!allowed.includes(targetType) || !targetId || !reason) {
    throw new DomainError("Choose what you are reporting and why.");
  }
  db.reports.unshift({
    id: randomUUID(),
    reporterId: actor.actorId,
    targetType: targetType as "profile",
    targetId,
    reason,
    details,
    status: "open",
    createdAt: now(),
  });
  audit(db, actor.actorId, "report", targetType, targetId, reason);
}

export function reviewProfile(db: Database, actor: Actor, input: Record<string, unknown>) {
  const user = requireUser(db, actor);
  if (user.role !== "member") {
    throw new DomainError("Ratings are given by signed-in users after an accepted order.", "forbidden", 403);
  }
  const profile = findProfile(db, text(input.profileId, 80));
  const rating = Number(input.rating);
  const body = text(input.body, 500);
  const connected = db.orders.some(
    (order) =>
      order.profileId === profile.id &&
      order.userId === user.id &&
      (order.status === "accepted" || order.status === "completed"),
  );
  if (!connected) {
    throw new DomainError("You can rate a profile after she accepts your order.", "ineligible", 403);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new DomainError("Choose a rating from 1 to 5.");
  if (body.length < 20) throw new DomainError("Write at least 20 characters so the review is useful.");
  if (
    db.reviews.some(
      (review) => review.profileId === profile.id && review.authorId === user.id && review.status !== "removed",
    )
  ) {
    throw new DomainError("You have already reviewed this profile.");
  }
  db.reviews.unshift({
    id: randomUUID(),
    profileId: profile.id,
    authorId: user.id,
    rating,
    body,
    createdAt: now(),
    status: "published",
  });
  notify(db, profile.userId, "announcements", "New review", "A member left a review on your profile.", `/profile/${profile.username}`);
}

function presentOrder(db: Database, order: OrderRecord, forHook: boolean): PublicOrder {
  const profile = db.profiles.find((item) => item.id === order.profileId);
  const customer = db.users.find((item) => item.id === order.userId);
  const rated = db.reviews.some(
    (review) => review.profileId === order.profileId && review.authorId === order.userId && review.status !== "removed",
  );
  return {
    id: order.id,
    status: order.status,
    note: order.note,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    profile: {
      id: order.profileId,
      username: profile?.username ?? "",
      displayName: profile?.displayName ?? "Hook",
      avatar: profile?.avatar ?? "",
    },
    customerName: forHook ? customer?.fullName || "User" : "You",
    canRate: !forHook && !rated && (order.status === "accepted" || order.status === "completed"),
    rated,
  };
}

export function placeOrder(db: Database, actor: Actor, input: Record<string, unknown>) {
  const user = requireUser(db, actor);
  if (user.role !== "member") {
    throw new DomainError("Orders are placed from a user account.", "forbidden", 403);
  }
  const profile = findProfile(db, text(input.profileId, 80));
  const owner = profile.userId ? db.users.find((item) => item.id === profile.userId) : undefined;
  if (!profile.userId || !owner || owner.status !== "active" || owner.deactivated) {
    throw new DomainError("This sample profile is a preview and cannot take orders.", "sample", 400);
  }
  if (hiddenFrom(db, actor, profile) || !isPubliclyListed(profile, owner.status)) {
    throw new DomainError("This profile is not taking orders right now.", "forbidden", 403);
  }
  const note = text(input.note, 500);
  if (db.orders.some((order) => order.userId === user.id && order.profileId === profile.id && order.status === "pending")) {
    throw new DomainError("You already have an order waiting for this profile.");
  }
  const recent = db.orders.filter((order) => order.userId === user.id && Date.now() - new Date(order.createdAt).getTime() < 60 * 60 * 1000);
  if (recent.length >= 10) throw new DomainError("You are placing orders too quickly. Try again later.", "rate", 429);
  const order: OrderRecord = {
    id: randomUUID(),
    userId: user.id,
    profileId: profile.id,
    note,
    status: "pending",
    createdAt: now(),
    updatedAt: now(),
  };
  db.orders.unshift(order);
  notify(db, profile.userId, "orders", "New order", `${user.fullName} placed an order.`, "/orders");
  return order.id;
}

export function respondOrder(db: Database, actor: Actor, orderId: string, action: string) {
  const user = requireUser(db, actor);
  const order = db.orders.find((item) => item.id === orderId);
  if (!order) throw new DomainError("Order not found.", "missing", 404);
  const profile = findProfile(db, order.profileId);
  const isHook = profile.userId === user.id;
  const isBuyer = order.userId === user.id;
  if (!isHook && !isBuyer) throw new DomainError("Order not found.", "missing", 404);
  if (isHook && order.status === "pending" && (action === "accept" || action === "decline")) {
    order.status = action === "accept" ? "accepted" : "declined";
    notify(db, order.userId, "orders", action === "accept" ? "Order accepted" : "Order declined", `${profile.displayName} ${action === "accept" ? "accepted" : "declined"} your order.`, "/orders");
  } else if (isHook && order.status === "accepted" && action === "complete") {
    order.status = "completed";
    notify(db, order.userId, "orders", "Order completed", `Rate ${profile.displayName} from your orders.`, "/orders");
  } else if (isBuyer && (order.status === "pending" || order.status === "accepted") && action === "cancel") {
    order.status = "cancelled";
    notify(db, profile.userId, "orders", "Order cancelled", `${user.fullName} cancelled an order.`, "/orders");
  } else {
    throw new DomainError("That order cannot be changed right now.");
  }
  order.updatedAt = now();
}

export function listOrders(db: Database, actor: Actor) {
  const user = requireUser(db, actor);
  const mine = db.profiles.find((item) => item.userId === user.id);
  const forHook = user.role === "creator";
  const items = db.orders
    .filter((order) => (forHook ? order.profileId === mine?.id : order.userId === user.id))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((order) => presentOrder(db, order, forHook));
  return { role: user.role, items, viewer: buildViewer(db, actor) };
}

/** Everything the user profile screen needs: saved posts, ratings given, orders, following. */
export function memberHome(db: Database, actor: Actor) {
  const user = requireUser(db, actor);
  const savedIds = new Set(db.savedPosts.filter((save) => save.userId === user.id).map((save) => save.targetId));
  const followedIds = new Set(db.follows.filter((follow) => follow.userId === user.id).map((follow) => follow.profileId));
  const ratings: GivenRating[] = db.reviews
    .filter((review) => review.authorId === user.id && review.status !== "removed")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((review) => {
      const profile = db.profiles.find((item) => item.id === review.profileId);
      return {
        id: review.id,
        rating: review.rating,
        body: review.body,
        createdAt: review.createdAt,
        profile: { id: review.profileId, username: profile?.username ?? "", displayName: profile?.displayName ?? "Hook", avatar: profile?.avatar ?? "" },
      };
    });
  const listed = listedProfiles(db, actor);
  return {
    viewer: buildViewer(db, actor),
    account: { fullName: user.fullName, email: user.email, avatar: user.avatar ?? "", joinedAt: user.createdAt, role: user.role },
    following: listed.filter((profile) => followedIds.has(profile.id)).map((profile) => presentProfile(db, profile)),
    savedPosts: db.posts
      .filter((post) => savedIds.has(post.id) && post.visibility === "public")
      .map((post) => presentPost(db, post)),
    ratings,
    orders: db.orders.filter((order) => order.userId === user.id).length,
  };
}

function completion(db: Database, profile: ProfileRecord) {
  const posts = db.posts.filter((post) => post.profileId === profile.id);
  const checks = [
    Boolean(profile.avatar),
    Boolean(profile.cover),
    profile.bio.trim().length >= 40,
    profile.interests.length >= 3,
    Boolean(profile.city),
    posts.length >= 1,
    profile.ageVerified && profile.identityVerified,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function dashboard(db: Database, actor: Actor) {
  const user = requireUser(db, actor);
  if (user.role === "admin") {
    return { role: "admin" as const, viewer: buildViewer(db, actor) };
  }
  const profile = creatorProfile(db, user);
  const verification = db.verifications.find((item) => item.profileId === profile.id);
  const posts = db.posts
    .filter((post) => post.profileId === profile.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((post) => ({
      ...presentPost(db, post),
      visibility: post.visibility,
      comments: db.comments
        .filter((comment) => comment.postId === post.id)
        .map((comment) => ({
          id: comment.id,
          body: comment.body,
          hidden: comment.hidden,
          createdAt: comment.createdAt,
          authorName: db.users.find((item) => item.id === comment.authorId)?.fullName || "Member",
        })),
    }));
  const engagement = posts.reduce((sum, post) => sum + post.likeCount + post.commentCount, 0);
  const pendingOrders = db.orders.filter((order) => order.profileId === profile.id && order.status === "pending").length;
  return {
    role: "creator" as const,
    viewer: buildViewer(db, actor),
    account: {
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      deactivated: user.deactivated,
      notificationPrefs: user.notificationPrefs,
    },
    profile: {
      ...presentProfile(db, profile),
      city: profile.city,
      region: profile.region,
      country: profile.country,
      locationPrivacy: profile.locationPrivacy,
      visibility: profile.visibility,
      discoverable: profile.discoverable,
      verification: verification?.status ?? "pending",
      completion: completion(db, profile),
    },
    posts,
    stats: {
      views: db.views.filter((view) => view.profileId === profile.id).length,
      followers: db.follows.filter((follow) => follow.profileId === profile.id).length,
      engagement,
      pendingOrders,
    },
    notifications: db.notifications.filter((item) => item.userId === user.id).slice(0, 30),
    blocked: db.blocks
      .filter((block) => block.ownerId === user.id)
      .map((block) => {
        const target = block.profileId ? db.profiles.find((item) => item.id === block.profileId) : undefined;
        return {
          id: block.id,
          name: target?.displayName || "Member",
          username: target?.username || null,
        };
      }),
  };
}

export function memberSettings(db: Database, actor: Actor) {
  const user = requireUser(db, actor);
  const profile = db.profiles.find((item) => item.userId === user.id);
  return {
    viewer: buildViewer(db, actor),
    account: {
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      deactivated: user.deactivated,
      notificationPrefs: user.notificationPrefs,
    },
    profile: profile
      ? {
          username: profile.username,
          visibility: profile.visibility,
          discoverable: profile.discoverable,
          locationPrivacy: profile.locationPrivacy,
          city: profile.city,
          region: profile.region,
          country: profile.country,
        }
      : null,
    blocked: db.blocks
      .filter((block) => block.ownerId === user.id)
      .map((block) => {
        const target = block.profileId ? db.profiles.find((item) => item.id === block.profileId) : undefined;
        return { id: block.id, name: target?.displayName || "Member", username: target?.username || null };
      }),
  };
}

export function updateAccount(db: Database, actor: Actor, input: Record<string, unknown>) {
  const user = requireUser(db, actor);
  if (typeof input.fullName === "string") user.fullName = text(input.fullName, 80);
  if (typeof input.phone === "string") user.phone = text(input.phone, 24);
  if (input.notificationPrefs && typeof input.notificationPrefs === "object") {
    const prefs = input.notificationPrefs as NotificationPrefs;
    user.notificationPrefs = { ...user.notificationPrefs, ...prefs };
  }
  if (input.currentPassword || input.nextPassword) {
    if (!verifyPassword(text(input.currentPassword, 80), user.passwordHash, user.passwordSalt)) {
      throw new DomainError("Current password is incorrect.", "auth", 401);
    }
    const nextPassword = text(input.nextPassword, 80);
    assertPassword(nextPassword);
    const hashed = hashPassword(nextPassword);
    user.passwordHash = hashed.hash;
    user.passwordSalt = hashed.salt;
    audit(db, user.id, "password", "user", user.id);
  }
  const profile = db.profiles.find((item) => item.userId === user.id);
  if (profile && user.role === "creator") {
    if (typeof input.displayName === "string") profile.displayName = text(input.displayName, 40);
    if (typeof input.bio === "string") profile.bio = text(input.bio, 280);
    if (Array.isArray(input.interests)) {
      profile.interests = input.interests
        .filter((item): item is string => typeof item === "string" && INTERESTS.includes(item as never))
        .slice(0, 8);
    }
    if (typeof input.city === "string") profile.city = text(input.city, 60);
    if (typeof input.region === "string") profile.region = text(input.region, 60);
    if (typeof input.country === "string") profile.country = text(input.country, 60);
    if (input.locationPrivacy === "city" || input.locationPrivacy === "region" || input.locationPrivacy === "hidden") {
      profile.locationPrivacy = input.locationPrivacy;
    }
    if (typeof input.avatar === "string") profile.avatar = assertImage(text(input.avatar, 300));
    if (typeof input.cover === "string") profile.cover = assertImage(text(input.cover, 300));
    if (input.visibility === "public" || input.visibility === "hidden") profile.visibility = input.visibility;
    if (input.discoverable === false) profile.discoverable = false;
    if (input.discoverable === true) {
      if (!profile.ageVerified || !profile.identityVerified || user.deactivated) {
        throw new DomainError("Your profile can be discovered after verification is approved.");
      }
      profile.discoverable = true;
      profile.visibility = "public";
    }
  }
  if (input.deactivate === true && profile) {
    user.deactivated = true;
    profile.discoverable = false;
    audit(db, user.id, "deactivate", "user", user.id);
  }
  if (input.reactivate === true) {
    user.deactivated = false;
    audit(db, user.id, "reactivate", "user", user.id);
  }
  if (input.deleteAccount === true) {
    user.status = "deleted";
    user.email = `deleted+${user.id}@daylight.invalid`;
    user.phone = "";
    user.fullName = "Deleted member";
    const hashed = hashPassword(randomUUID());
    user.passwordHash = hashed.hash;
    user.passwordSalt = hashed.salt;
    if (profile) {
      profile.discoverable = false;
      profile.visibility = "hidden";
      profile.displayName = "Deleted member";
      profile.bio = "";
      profile.avatar = "";
      profile.username = `deleted_${user.id.slice(0, 8)}`;
    }
    audit(db, user.id, "delete", "user", user.id);
  }
}

export function savePost(db: Database, actor: Actor, input: Record<string, unknown>, postId?: string) {
  const user = requireUser(db, actor);
  const profile = creatorProfile(db, user);
  const caption = text(input.caption, 2000);
  const images = Array.isArray(input.images)
    ? input.images.map((item) => assertImage(text(item, 300))).filter(Boolean).slice(0, 6)
    : [];
  if (!caption) throw new DomainError("Add a caption.");
  if (!images.length) throw new DomainError("Add at least one photo.");
  const frame = input.frame === "square" ? "square" : "portrait";
  if (postId) {
    const post = db.posts.find((item) => item.id === postId && item.profileId === profile.id);
    if (!post) throw new DomainError("Post not found.", "missing", 404);
    post.caption = caption;
    post.images = images;
    post.frame = frame;
    if (input.visibility === "public" || input.visibility === "hidden") post.visibility = input.visibility;
    return post.id;
  }
  const post: PostRecord = {
    id: randomUUID(),
    profileId: profile.id,
    images,
    caption,
    createdAt: now(),
    visibility: input.visibility === "hidden" ? "hidden" : "public",
    sample: false,
    frame,
  };
  db.posts.unshift(post);
  return post.id;
}

export function removePost(db: Database, actor: Actor, postId: string) {
  const user = requireUser(db, actor);
  const profile = creatorProfile(db, user);
  const post = db.posts.find((item) => item.id === postId && item.profileId === profile.id);
  if (!post) throw new DomainError("Post not found.", "missing", 404);
  db.posts = db.posts.filter((item) => item.id !== postId);
  db.comments = db.comments.filter((comment) => comment.postId !== postId);
  db.likes = db.likes.filter((like) => like.postId !== postId);
  db.savedPosts = db.savedPosts.filter((save) => save.targetId !== postId);
}

export function notificationsFor(db: Database, actor: Actor) {
  if (!actor.user) return { items: [], unread: 0, viewer: buildViewer(db, actor) };
  const items = db.notifications.filter((item) => item.userId === actor.user?.id).slice(0, 40);
  return {
    items,
    unread: items.filter((item) => !item.read).length,
    viewer: buildViewer(db, actor),
  };
}

export function markNotifications(db: Database, actor: Actor) {
  const user = requireUser(db, actor);
  db.notifications.forEach((item) => {
    if (item.userId === user.id) item.read = true;
  });
}

function requireAdmin(actor: Actor) {
  if (!actor.user || actor.user.role !== "admin" || actor.user.status !== "active") {
    throw new DomainError("Administrator access is required.", "forbidden", 403);
  }
  return actor.user;
}

export function adminOverview(db: Database, actor: Actor) {
  requireAdmin(actor);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const users = db.users
    .filter((user) => user.status !== "deleted")
    .map((user) => {
      const profile = db.profiles.find((item) => item.userId === user.id);
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        status: user.status,
        deactivated: user.deactivated,
        createdAt: user.createdAt,
        username: profile?.username ?? null,
        discoverable: profile?.discoverable ?? false,
      };
    });
  return {
    metrics: {
      members: db.users.filter((user) => user.status !== "deleted").length,
      creators: db.users.filter((user) => user.role === "creator" && user.status !== "deleted").length,
      pending: db.verifications.filter((item) => item.status === "pending").length,
      recentSignups: db.users.filter((user) => new Date(user.createdAt).getTime() > weekAgo).length,
      openReports: db.reports.filter((report) => report.status === "open").length,
      reviews: db.reviews.filter((review) => review.status === "published").length,
      posts: db.posts.length,
    },
    verifications: db.verifications
      .filter((item) => item.status === "pending")
      .map((item) => {
        const profile = db.profiles.find((profileItem) => profileItem.id === item.profileId);
        const user = db.users.find((userItem) => userItem.id === item.userId);
        return {
          id: item.id,
          createdAt: item.createdAt,
          email: user?.email ?? "",
          fullName: user?.fullName ?? "",
          username: profile?.username ?? "",
          displayName: profile?.displayName ?? "",
          avatar: profile?.avatar ?? "",
          bio: profile?.bio ?? "",
          city: profile?.city ?? "",
          country: profile?.country ?? "",
          age: profile ? ageFromDob(profile.dateOfBirth) : null,
          sample: profile?.sample ?? false,
        };
      }),
    reports: db.reports.slice(0, 40).map((report) => ({
      ...report,
      snippet: snippetFor(db, report.targetType, report.targetId),
    })),
    reviews: db.reviews.slice(0, 30).map((review) => ({
      ...review,
      authorName: db.users.find((user) => user.id === review.authorId)?.fullName || "Member",
      profileName: db.profiles.find((profile) => profile.id === review.profileId)?.displayName || "Profile",
    })),
    appeals: db.appeals.slice(0, 20).map((appeal) => ({
      ...appeal,
      email: db.users.find((user) => user.id === appeal.userId)?.email ?? "",
    })),
    audits: db.audits.slice(0, 40),
    users,
  };
}

function snippetFor(db: Database, type: string, id: string) {
  if (type === "profile") return db.profiles.find((item) => item.id === id)?.displayName ?? id;
  if (type === "post") return db.posts.find((item) => item.id === id)?.caption.slice(0, 80) ?? id;
  if (type === "comment") return db.comments.find((item) => item.id === id)?.body.slice(0, 80) ?? id;
  if (type === "review") return db.reviews.find((item) => item.id === id)?.body.slice(0, 80) ?? id;
  return id;
}

export function adminAct(db: Database, actor: Actor, input: Record<string, unknown>) {
  const admin = requireAdmin(actor);
  const action = text(input.action, 40);
  const id = text(input.id, 80);
  if (action === "approve" || action === "reject") {
    const verification = db.verifications.find((item) => item.id === id);
    if (!verification) throw new DomainError("Verification request not found.", "missing", 404);
    const profile = findProfile(db, verification.profileId);
    verification.status = action === "approve" ? "approved" : "rejected";
    verification.note = text(input.note, 200);
    verification.updatedAt = now();
    if (action === "approve") {
      const age = profile.dateOfBirth ? ageFromDob(profile.dateOfBirth) : null;
      if (profile.dateOfBirth && (age === null || age < 18)) {
        throw new DomainError("This date of birth is not eligible for a public profile.");
      }
      profile.ageVerified = true;
      profile.identityVerified = true;
      profile.discoverable = true;
      profile.visibility = "public";
      notify(db, verification.userId, "verification", "Profile approved", "Your profile can now be discovered.", `/profile/${profile.username}`);
    } else {
      profile.discoverable = false;
      notify(db, verification.userId, "verification", "Profile not approved", verification.note || "Update your profile and wait for another review.", "/dashboard");
    }
    audit(db, admin.id, action, "verification", verification.id, verification.note);
    return;
  }
  if (action === "suspend" || action === "restore") {
    const user = db.users.find((item) => item.id === id);
    if (!user || user.role === "admin") throw new DomainError("That member cannot be changed.", "forbidden", 403);
    user.status = action === "suspend" ? "suspended" : "active";
    const profile = db.profiles.find((item) => item.userId === user.id);
    if (action === "suspend" && profile) profile.discoverable = false;
    if (action === "restore") {
      db.appeals.forEach((appeal) => {
        if (appeal.userId === user.id && appeal.status === "open") appeal.status = "approved";
      });
    }
    audit(db, admin.id, action, "user", user.id);
    return;
  }
  if (action === "deny-appeal") {
    const appeal = db.appeals.find((item) => item.id === id);
    if (!appeal) throw new DomainError("Appeal not found.", "missing", 404);
    appeal.status = "denied";
    audit(db, admin.id, "deny-appeal", "appeal", appeal.id);
    return;
  }
  if (action === "resolve" || action === "dismiss") {
    const report = db.reports.find((item) => item.id === id);
    if (!report) throw new DomainError("Report not found.", "missing", 404);
    report.status = action === "resolve" ? "resolved" : "dismissed";
    if (action === "resolve" && input.hide === true) hideTarget(db, report.targetType, report.targetId);
    audit(db, admin.id, action, "report", report.id);
    return;
  }
  if (action === "hide-review" || action === "remove-review") {
    const review = db.reviews.find((item) => item.id === id);
    if (!review) throw new DomainError("Review not found.", "missing", 404);
    review.status = action === "hide-review" ? "hidden" : "removed";
    audit(db, admin.id, action, "review", review.id);
    return;
  }
  throw new DomainError("Unknown admin action.");
}

function hideTarget(db: Database, type: string, id: string) {
  if (type === "post") {
    const post = db.posts.find((item) => item.id === id);
    if (post) post.visibility = "hidden";
  }
  if (type === "comment") {
    const comment = db.comments.find((item) => item.id === id);
    if (comment) comment.hidden = true;
  }
  if (type === "review") {
    const review = db.reviews.find((item) => item.id === id);
    if (review) review.status = "hidden";
  }
  if (type === "profile") {
    const profile = db.profiles.find((item) => item.id === id);
    if (profile) {
      profile.discoverable = false;
      profile.visibility = "hidden";
    }
  }
}
