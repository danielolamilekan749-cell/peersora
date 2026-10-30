import { ageFromDob, cityLabelOf, isRecentlyJoined } from "@/lib/format";
import type {
  Database,
  PostRecord,
  ProfileRecord,
  PublicComment,
  PublicPost,
  PublicProfile,
  PublicReview,
  ViewerState,
} from "@/lib/types";

export function emptyViewer(id: string): ViewerState {
  return {
    id,
    role: "guest",
    email: null,
    fullName: null,
    username: null,
    profileId: null,
    follows: [],
    savedProfiles: [],
    savedPosts: [],
    likes: [],
    blocks: [],
  };
}

export function presenceOf(profile: ProfileRecord, now = Date.now()) {
  if (profile.presenceHint) return profile.presenceHint;
  const delta = now - new Date(profile.lastActiveAt).getTime();
  if (delta < 5 * 60 * 1000) return "online" as const;
  if (delta < 36 * 60 * 60 * 1000) return "recent" as const;
  return "offline" as const;
}

export function ratingFor(db: Database, profileId: string) {
  const reviews = db.reviews.filter(
    (review) => review.profileId === profileId && review.status === "published",
  );
  if (!reviews.length) return { rating: null, reviewCount: 0 };
  const rating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return { rating: Math.round(rating * 10) / 10, reviewCount: reviews.length };
}

export function presentProfile(db: Database, profile: ProfileRecord, now = Date.now()): PublicProfile {
  const age = ageFromDob(profile.dateOfBirth, new Date(now));
  const { rating, reviewCount } = ratingFor(db, profile.id);
  const followers = db.follows.filter((follow) => follow.profileId === profile.id).length;
  const following = profile.userId
    ? db.follows.filter((follow) => follow.userId === profile.userId).length
    : 0;
  const owner = profile.userId ? db.users.find((user) => user.id === profile.userId) : undefined;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    age: profile.ageVerified && age !== null && age >= 18 ? age : null,
    cityLabel: cityLabelOf(profile),
    country: profile.country,
    verified: profile.identityVerified,
    bio: profile.bio,
    interests: profile.interests,
    avatar: profile.avatar,
    cover: profile.cover,
    presence: presenceOf(profile, now),
    joinedAt: profile.joinedAt,
    featured: profile.featured,
    isNew: isRecentlyJoined(profile.joinedAt, now),
    followers,
    following,
    postCount: db.posts.filter(
      (post) => post.profileId === profile.id && post.visibility === "public",
    ).length,
    sample: profile.sample,
    orderable: Boolean(owner && owner.status === "active" && !owner.deactivated),
    rating,
    reviewCount,
  };
}

export function presentPost(db: Database, post: PostRecord): PublicPost {
  const profile = db.profiles.find((item) => item.id === post.profileId);
  return {
    id: post.id,
    profileId: post.profileId,
    username: profile?.username ?? "member",
    displayName: profile?.displayName ?? "Member",
    avatar: profile?.avatar ?? "",
    images: post.images,
    caption: post.caption,
    createdAt: post.createdAt,
    likeCount: db.likes.filter((like) => like.postId === post.id).length,
    commentCount: db.comments.filter((comment) => comment.postId === post.id && !comment.hidden)
      .length,
    sample: post.sample,
    frame: post.frame,
  };
}

export function presentComments(db: Database, postId: string): PublicComment[] {
  return db.comments
    .filter((comment) => comment.postId === postId && !comment.hidden)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map((comment) => {
      const user = db.users.find((item) => item.id === comment.authorId);
      return {
        id: comment.id,
        postId: comment.postId,
        authorName: user?.fullName || "Member",
        body: comment.body,
        createdAt: comment.createdAt,
      };
    });
}

export function presentReviews(db: Database, profileId: string): PublicReview[] {
  return db.reviews
    .filter((review) => review.profileId === profileId && review.status === "published")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((review) => {
      const user = db.users.find((item) => item.id === review.authorId);
      return {
        id: review.id,
        authorName: user?.fullName || "Member",
        rating: review.rating,
        body: review.body,
        createdAt: review.createdAt,
      };
    });
}

export function isAdultProfile(profile: ProfileRecord) {
  if (!profile.ageVerified) return false;
  if (!profile.dateOfBirth) return true;
  const age = ageFromDob(profile.dateOfBirth);
  return age !== null && age >= 18;
}

export function isPubliclyListed(profile: ProfileRecord, userStatus?: string) {
  if (!profile.discoverable || profile.visibility !== "public") return false;
  if (userStatus === "suspended" || userStatus === "deleted") return false;
  return isAdultProfile(profile);
}
