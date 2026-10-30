import type { PublicPost, PublicProfile } from "@/lib/types";

export type DiscoveryFilter =
  | "all"
  | "popular"
  | "recent"
  | "active"
  | "rated"
  | "verified";

export type DiscoverySort = "suggested" | "newest" | "followed" | "active" | "rated";

const presenceRank = { online: 0, recent: 1, offline: 2 };

export function filterProfiles(
  profiles: PublicProfile[],
  options: {
    q?: string;
    filter?: DiscoveryFilter;
    sort?: DiscoverySort;
    interest?: string;
    location?: string;
  },
) {
  const query = options.q?.trim().toLowerCase() ?? "";
  const filtered = profiles.filter((profile) => {
    if (options.filter === "popular" && !profile.featured) return false;
    if (options.filter === "recent" && !isRecent(profile.joinedAt)) return false;
    if (options.filter === "active" && profile.presence === "offline") return false;
    if (options.filter === "rated" && profile.reviewCount < 1) return false;
    if (options.filter === "verified" && !profile.verified) return false;
    if (options.interest && !profile.interests.includes(options.interest)) return false;
    if (options.location && options.location !== "Anywhere") {
      const haystack = `${profile.cityLabel} ${profile.country}`.toLowerCase();
      if (!haystack.includes(options.location.toLowerCase())) return false;
    }
    if (!query) return true;
    const blob = [
      profile.displayName,
      profile.username,
      profile.bio,
      profile.cityLabel,
      profile.country,
      profile.interests.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(query);
  });

  return filtered.sort((a, b) => {
    if (options.sort === "newest") {
      return +new Date(b.joinedAt) - +new Date(a.joinedAt);
    }
    if (options.sort === "followed") return b.followers - a.followers;
    if (options.sort === "active") {
      return presenceRank[a.presence] - presenceRank[b.presence];
    }
    if (options.sort === "rated") return (b.rating ?? -1) - (a.rating ?? -1);
    return (
      Number(b.featured) - Number(a.featured) ||
      presenceRank[a.presence] - presenceRank[b.presence] ||
      +new Date(b.joinedAt) - +new Date(a.joinedAt)
    );
  });
}

export function filterPosts(posts: PublicPost[], profiles: PublicProfile[]) {
  const ids = new Set(profiles.map((profile) => profile.id));
  return posts
    .filter((post) => ids.has(post.profileId))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function isRecent(iso: string) {
  return Date.now() - new Date(iso).getTime() < 30 * 24 * 60 * 60 * 1000;
}
