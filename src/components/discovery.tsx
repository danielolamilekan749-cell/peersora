"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { REPORT_REASONS } from "@/lib/constants";
import { filterPosts, filterProfiles } from "@/lib/discovery";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PublicPost, PublicProfile } from "@/lib/types";
import { ImageCarousel } from "@/components/carousel";
import { Icon } from "@/components/icon";
import { usePlatform } from "@/components/platform";
import { Avatar, Button, controlClass, Dialog, EmptyState, Field, Menu, MenuItem } from "@/components/ui";

export function DiscoveryScreen({ mode }: { mode: "home" | "explore" }) {
  const { profiles, posts, place, setPlace, loading } = usePlatform();
  const params = useSearchParams();
  const router = useRouter();
  const initialQuery = mode === "explore" ? params.get("q") ?? "" : "";
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState(initialQuery);

  useEffect(() => {
    if (mode !== "explore") return;
    const handle = window.setTimeout(() => setQuery(draft), 250);
    return () => window.clearTimeout(handle);
  }, [draft, mode]);

  useEffect(() => {
    if (mode !== "explore") return;
    const current = params.get("q") ?? "";
    if (current === query) return;
    const next = new URLSearchParams(params.toString());
    if (query) next.set("q", query);
    else next.delete("q");
    const suffix = next.toString();
    router.replace(suffix ? `/explore?${suffix}` : "/explore", { scroll: false });
  }, [mode, params, query, router]);

  const visible = useMemo(() => filterProfiles(profiles, { q: query, location: place }), [place, profiles, query]);
  const visiblePosts = useMemo(() => filterPosts(posts, visible), [posts, visible]);
  const stories = [...profiles].sort((a, b) => Number(b.featured || b.isNew) - Number(a.featured || a.isNew)).slice(0, 14);

  if (mode === "home") {
    return (
      <div className="mx-auto w-full max-w-[470px] pt-3 lg:pt-0">
        <Stories profiles={stories} />
        <div className="mt-3 space-y-3 lg:mt-4 lg:space-y-4">
          {visiblePosts.length ? (
            visiblePosts.map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <EmptyState icon="gallery" title="No posts yet" body="Public posts from discoverable profiles will show up in this feed." />
          )}
        </div>
        <p className="px-4 pt-6 text-center text-[11px] leading-5 text-muted">
          Adults 18 and over. Ratings appear only after a real, accepted order.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full pt-3 lg:max-w-[720px] lg:pt-0">
      <label className="relative block">
        <span className="sr-only">Search</span>
        <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search by name, interest, or city"
          className={cn(controlClass, "h-12 rounded-full pl-11 pr-11 text-[15px] [&::-webkit-search-cancel-button]:hidden")}
          autoComplete="off"
        />
        {draft ? (
          <button type="button" aria-label="Clear search" onClick={() => setDraft("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
            <Icon name="close" size={20} />
          </button>
        ) : null}
      </label>
      <div className="mt-4">
        {visible.length ? (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {visible.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-line/80" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="search"
            title="No profiles found"
            body="Try another name, interest, or city."
            action={<Button variant="outline" onClick={() => { setDraft(""); setPlace("Anywhere"); }}>Clear search</Button>}
          />
        )}
      </div>
    </div>
  );
}

function Stories({ profiles }: { profiles: PublicProfile[] }) {
  return (
    <div className="card scrollbar-none flex gap-3.5 overflow-x-auto px-3 py-3">
      {profiles.map((profile) => (
        <Link key={profile.id} href={`/profile/${profile.username}`} className="press w-[64px] shrink-0 text-center">
          <span className="story-ring relative mx-auto grid h-[62px] w-[62px] place-items-center rounded-full p-[2px]">
            <span className="relative block h-full w-full overflow-hidden rounded-full bg-white p-[2px]">
              <span className="relative block h-full w-full overflow-hidden rounded-full">
                <Image src={profile.avatar} alt="" fill sizes="64px" className="object-cover" />
              </span>
            </span>
            {profile.presence === "online" ? <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-success" /> : null}
          </span>
          <span className="mt-1.5 block truncate text-[11px] font-medium">{profile.username}</span>
        </Link>
      ))}
    </div>
  );
}

export function ProfileCard({ profile }: { profile: PublicProfile }) {
  return (
    <Link
      href={`/profile/${profile.username}`}
      className="card press flex flex-col items-center gap-1.5 p-2 text-center sm:gap-2 sm:p-3"
      aria-label={`${profile.displayName}${profile.rating ? `, rated ${profile.rating.toFixed(1)}` : ", not rated yet"}`}
    >
      <span className="relative block aspect-square w-full">
        <span className="relative block h-full w-full overflow-hidden rounded-full bg-rose ring-2 ring-white shadow-card">
          <Image src={profile.avatar} alt="" fill sizes="(min-width: 1024px) 160px, 25vw" className="object-cover" />
        </span>
        {profile.presence === "online" ? (
          <span className="absolute bottom-[6%] right-[6%] h-3 w-3 rounded-full border-2 border-white bg-success sm:h-3.5 sm:w-3.5" />
        ) : null}
      </span>
      <span className="flex w-full items-center justify-center gap-0.5 text-[11px] font-semibold leading-tight sm:text-[13px]">
        <span className="truncate">{profile.displayName.split(" ")[0]}</span>
        {profile.verified ? <Icon name="verified" size={12} className="shrink-0 text-plum" /> : null}
      </span>
      <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium sm:text-xs", profile.rating ? "text-ink" : "text-muted")}>
        <Icon name={profile.rating ? "starBold" : "star"} size={12} className={profile.rating ? "text-plum" : ""} />
        {profile.rating ? profile.rating.toFixed(1) : "New"}
      </span>
    </Link>
  );
}

export function PostCard({ post }: { post: PublicPost }) {
  const { viewer, like, savePost, orderNow, profiles } = usePlatform();
  const [reportOpen, setReportOpen] = useState(false);
  const liked = viewer?.likes.includes(post.id);
  const saved = viewer?.savedPosts.includes(post.id);
  const profile = profiles.find((item) => item.id === post.profileId);

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 px-3.5 py-2.5">
        <Link href={`/profile/${post.username}`} className="shrink-0">
          <Avatar src={post.avatar} size={38} ring />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex min-w-0 items-center gap-1 text-sm">
            <Link href={`/profile/${post.username}`} className="truncate font-semibold">{post.username}</Link>
            {profile?.verified ? <Icon name="verified" size={14} className="shrink-0 text-plum" /> : null}
            <span className="text-muted">·</span>
            <span className="shrink-0 text-xs text-muted">{formatWhen(post.createdAt)}</span>
          </div>
          <p className="truncate text-xs text-muted">
            {profile?.cityLabel}
          </p>
        </div>
        {profile ? (
          <Button size="sm" variant="soft" className="h-8 gap-1.5 px-3.5 text-xs" onClick={() => orderNow(profile)}>
            <Icon name="bag" size={14} /> Order now
          </Button>
        ) : null}
        <Menu label="Post actions">
          <MenuItem icon="link" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`)}>Copy link</MenuItem>
          <MenuItem icon="flag" onClick={() => setReportOpen(true)}>Report post</MenuItem>
        </Menu>
      </header>
      <div className="mx-2">
        <ImageCarousel
          images={post.images}
          alt={`Post by ${post.displayName}`}
          href={`/posts/${post.id}`}
          sizes="(min-width: 1024px) 470px, 100vw"
          className={cn("rounded-xl", post.frame === "square" ? "aspect-square" : "aspect-[4/5]")}
        />
      </div>
      <div className="px-3.5 pb-4 pt-2.5">
        <div className="flex items-center gap-1 text-sm">
          <ActionButton icon={liked ? "heartBold" : "heart"} label="Like" active={liked} count={post.likeCount} onClick={() => like(post.id)} />
          <Link href={`/posts/${post.id}`} aria-label="Comments" className="press flex h-9 items-center gap-1.5 rounded-full px-2 hover:bg-canvas">
            <Icon name="comment" size={24} />
            {post.commentCount > 0 ? <span className="text-[13px] font-medium">{compactCount(post.commentCount)}</span> : null}
          </Link>
          <ActionButton icon="send" label="Share" onClick={() => share(`/posts/${post.id}`)} />
          <ActionButton icon={saved ? "bookmarkBold" : "bookmark"} label="Save post" active={saved} className="ml-auto" onClick={() => savePost(post.id)} />
        </div>
        <p className="mt-1 text-sm leading-5">
          <Link href={`/profile/${post.username}`} className="font-semibold">{post.username}</Link> {post.caption}
        </p>
        {post.commentCount > 0 ? (
          <Link href={`/posts/${post.id}`} className="mt-1 inline-block text-[13px] text-muted hover:text-ink">
            View all {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
          </Link>
        ) : null}
      </div>
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="post" targetId={post.id} />
    </article>
  );
}

function ActionButton({ icon, label, count, active, onClick, className }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; count?: number; active?: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" aria-pressed={active} aria-label={label} onClick={onClick} className={cn("press flex h-9 items-center gap-1.5 rounded-full px-2 hover:bg-canvas", active && "text-plum", className)}>
      <Icon name={icon} size={24} />
      {count && count > 0 ? <span className="text-[13px] font-medium">{compactCount(count)}</span> : null}
    </button>
  );
}

function compactCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
}) {
  const { report } = usePlatform();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} title="Report" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Reason">
          <select value={reason} onChange={(event) => setReason(event.target.value)} className={controlClass}>
            {REPORT_REASONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Details" hint="Include what happened. Reports of suspected minors are reviewed first.">
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={4} className={`${controlClass} h-auto py-3`} />
        </Field>
        <Button className="w-full" loading={busy} onClick={async () => {
          setBusy(true);
          try {
            const ok = await report({ targetType, targetId, reason, details });
            if (ok) onClose();
          } finally {
            setBusy(false);
          }
        }}>
          <Icon name="flag" size={16} /> Submit report
        </Button>
      </div>
    </Dialog>
  );
}

export async function share(path: string) {
  const url = `${window.location.origin}${path}`;
  if (navigator.share) {
    await navigator.share({ url }).catch(() => undefined);
    return;
  }
  await navigator.clipboard.writeText(url);
}

export function Presence({ value }: { value: PublicProfile["presence"] }) {
  if (value === "offline") return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      {value === "online" ? "Online now" : "Active recently"}
    </span>
  );
}
