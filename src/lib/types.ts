export type Role = "member" | "creator" | "admin";

export type Presence = "online" | "recent" | "offline";

export type LocationPrivacy = "city" | "region" | "hidden";

export type UserStatus = "active" | "suspended" | "deleted";

export type NotificationPrefs = {
  followers: boolean;
  likes: boolean;
  comments: boolean;
  orders: boolean;
  announcements: boolean;
  verification: boolean;
};

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: Role;
  fullName: string;
  phone: string;
  status: UserStatus;
  provider?: "password" | "google";
  avatar?: string;
  deactivated: boolean;
  createdAt: string;
  lastActiveAt: string;
  notificationPrefs: NotificationPrefs;
};

export type ProfileRecord = {
  id: string;
  userId: string | null;
  username: string;
  displayName: string;
  bio: string;
  interests: string[];
  avatar: string;
  cover: string;
  city: string;
  region: string;
  country: string;
  locationPrivacy: LocationPrivacy;
  dateOfBirth: string;
  ageVerified: boolean;
  identityVerified: boolean;
  visibility: "public" | "hidden";
  discoverable: boolean;
  featured: boolean;
  sample: boolean;
  presenceHint: Presence | null;
  joinedAt: string;
  lastActiveAt: string;
};

export type PostRecord = {
  id: string;
  profileId: string;
  images: string[];
  caption: string;
  createdAt: string;
  visibility: "public" | "hidden";
  sample: boolean;
  frame: "portrait" | "square";
};

export type CommentRecord = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  hidden: boolean;
};

export type FollowRecord = {
  userId: string;
  profileId: string;
  createdAt: string;
};

export type LikeRecord = {
  userId: string;
  postId: string;
  createdAt: string;
};

export type SaveRecord = {
  userId: string;
  targetId: string;
  createdAt: string;
};

export type BlockRecord = {
  id: string;
  ownerId: string;
  profileId: string | null;
  userId: string | null;
  createdAt: string;
};

export type OrderStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

export type OrderRecord = {
  id: string;
  userId: string;
  profileId: string;
  note: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReviewRecord = {
  id: string;
  profileId: string;
  authorId: string;
  rating: number;
  body: string;
  createdAt: string;
  status: "published" | "hidden" | "removed";
};

export type ReportRecord = {
  id: string;
  reporterId: string;
  targetType: "profile" | "post" | "comment" | "message" | "review";
  targetId: string;
  reason: string;
  details: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type AuditRecord = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  meta: string;
  createdAt: string;
};

export type VerificationRecord = {
  id: string;
  userId: string;
  profileId: string;
  status: "pending" | "approved" | "rejected";
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type AppealRecord = {
  id: string;
  userId: string;
  message: string;
  status: "open" | "approved" | "denied";
  createdAt: string;
};

export type ViewRecord = {
  profileId: string;
  viewerKey: string;
  day: string;
};

export type Database = {
  version: number;
  users: UserRecord[];
  profiles: ProfileRecord[];
  posts: PostRecord[];
  comments: CommentRecord[];
  follows: FollowRecord[];
  likes: LikeRecord[];
  savedProfiles: SaveRecord[];
  savedPosts: SaveRecord[];
  blocks: BlockRecord[];
  orders: OrderRecord[];
  reviews: ReviewRecord[];
  reports: ReportRecord[];
  notifications: NotificationRecord[];
  audits: AuditRecord[];
  verifications: VerificationRecord[];
  appeals: AppealRecord[];
  views: ViewRecord[];
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  age: number | null;
  cityLabel: string;
  country: string;
  verified: boolean;
  bio: string;
  interests: string[];
  avatar: string;
  cover: string;
  presence: Presence;
  joinedAt: string;
  featured: boolean;
  isNew: boolean;
  followers: number;
  following: number;
  postCount: number;
  sample: boolean;
  orderable: boolean;
  rating: number | null;
  reviewCount: number;
};

export type PublicComment = {
  id: string;
  postId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type PublicPost = {
  id: string;
  profileId: string;
  username: string;
  displayName: string;
  avatar: string;
  images: string[];
  caption: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  sample: boolean;
  frame: "portrait" | "square";
};

export type ViewerState = {
  id: string;
  role: Role | "guest";
  email: string | null;
  fullName: string | null;
  username: string | null;
  profileId: string | null;
  follows: string[];
  savedProfiles: string[];
  savedPosts: string[];
  likes: string[];
  blocks: string[];
};

export type PublicReview = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
};

export type PublicOrder = {
  id: string;
  status: OrderStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
  profile: { id: string; username: string; displayName: string; avatar: string };
  customerName: string;
  canRate: boolean;
  rated: boolean;
};

export type GivenRating = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  profile: { id: string; username: string; displayName: string; avatar: string };
};
