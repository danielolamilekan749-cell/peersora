"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icon";
import { ProfileCard } from "@/components/discovery";
import { usePlatform } from "@/components/platform";
import { Button, EmptyState, PageTitle } from "@/components/ui";

export function SavedScreen() {
  const { viewer, posts, profiles, askJoin, loading } = usePlatform();
  const [tab, setTab] = useState<"posts" | "profiles">("posts");
  const signedIn = Boolean(viewer && viewer.role !== "guest");
  const savedPosts = useMemo(() => {
    const ids = new Set(viewer?.savedPosts ?? []);
    return posts.filter((post) => ids.has(post.id));
  }, [posts, viewer]);
  const savedProfiles = useMemo(() => {
    const ids = new Set(viewer?.savedProfiles ?? []);
    return profiles.filter((profile) => ids.has(profile.id));
  }, [profiles, viewer]);

  if (!signedIn && !loading) {
    return (
      <div className="pt-3 lg:max-w-[720px] lg:pt-0">
        <PageTitle title="Saved" />
        <div className="mt-4">
          <EmptyState icon="bookmark" title="Save posts you like" body="Tap the bookmark on any post and it will be kept here. Join to start saving." action={<Button onClick={askJoin}>Join Daylight</Button>} />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3 lg:max-w-[720px] lg:pt-0">
      <PageTitle title="Saved" subtitle={`${savedPosts.length} post${savedPosts.length === 1 ? "" : "s"} · ${savedProfiles.length} profile${savedProfiles.length === 1 ? "" : "s"}`} />
      <div role="tablist" className="mt-4 grid grid-cols-2 border-b border-line">
        {(["posts", "profiles"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={cn("press relative flex h-11 items-center justify-center gap-2 text-sm font-semibold capitalize", tab === item ? "text-ink" : "text-muted hover:text-ink")}>
            <Icon name={item === "posts" ? (tab === item ? "gridBold" : "grid") : tab === item ? "userBold" : "user"} size={19} /> {item}
            {tab === item ? <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-ink" /> : null}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "posts" ? (
          savedPosts.length ? (
            <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-2xl sm:gap-1">
              {savedPosts.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`} className="group relative aspect-[3/4] overflow-hidden bg-rose">
                  {post.images[0] ? <Image src={post.images[0]} alt={`Saved post by ${post.displayName}`} fill sizes="(min-width: 768px) 240px, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /> : null}
                  <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/60 to-transparent" />
                  <span className="absolute bottom-1.5 left-2 right-2 truncate text-[11px] font-semibold text-white">{post.username}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon="bookmark" title="No saved posts yet" body="Tap the bookmark under any post to keep it here." action={<Link href="/" className="press inline-flex h-11 items-center rounded-full bg-plum px-5 text-sm font-semibold text-white">Browse the feed</Link>} />
          )
        ) : savedProfiles.length ? (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {savedProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}
          </div>
        ) : (
          <EmptyState icon="user" title="No saved profiles" body="Use the menu on a profile and choose Save profile." />
        )}
      </div>
    </div>
  );
}
