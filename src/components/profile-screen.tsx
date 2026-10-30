"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/format";
import type { PublicPost, PublicProfile, PublicReview } from "@/lib/types";
import { ReportDialog, share } from "@/components/discovery";
import { Icon, type IconName } from "@/components/icon";
import { usePlatform } from "@/components/platform";
import { Button, controlClass, Dialog, EmptyState, Field, IconButton, Menu, MenuItem, Skeleton, Tag } from "@/components/ui";

type Detail = {
  profile: PublicProfile;
  posts: PublicPost[];
  reviews: PublicReview[];
  canReview: boolean;
};

type TabId = "posts" | "ratings" | "about";

const tabs: { id: TabId; label: string; icon: IconName; activeIcon: IconName }[] = [
  { id: "posts", label: "Posts", icon: "grid", activeIcon: "gridBold" },
  { id: "ratings", label: "Ratings", icon: "ratings", activeIcon: "ratingsBold" },
  { id: "about", label: "About", icon: "info", activeIcon: "info" },
];

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

export function ProfileScreen({ username, initialTab = "posts" }: { username: string; initialTab?: TabId }) {
  const { profiles, posts, viewer, block, saveProfile, orderNow } = usePlatform();
  const known = profiles.find((profile) => profile.username === username);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<Detail>(`/api/profiles/${username}`)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Profile unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  const profile = detail?.profile ?? known;
  const gallery = detail?.posts ?? posts.filter((post) => post.profileId === known?.id);

  if (!profile && loading) return <ProfileSkeleton />;
  if (!profile) return <EmptyState icon="lock" title="Profile unavailable" body={error || "This profile is private, removed, or still waiting for verification."} />;

  const owner = viewer?.profileId === profile.id;
  const saved = viewer?.savedProfiles.includes(profile.id);
  const likes = gallery.reduce((sum, post) => sum + post.likeCount, 0);
  const hiddenFromPublic = owner && !profiles.some((item) => item.id === profile.id);

  return (
    <div className="mx-auto max-w-2xl pt-3 lg:pt-0">
      {hiddenFromPublic ? (
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-white px-4 py-3 text-[13px] leading-5 text-muted ring-1 ring-line">
          <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-plum" />
          Only you can see this profile until age and identity verification is approved. You can already add posts.
        </p>
      ) : null}
      <section className="card relative overflow-hidden px-4 pb-5 pt-7 text-center">
        <span className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-rose to-transparent" />
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          <IconButton icon="share" label="Share profile" onClick={() => share(`/profile/${profile.username}`)} />
          {owner ? null : (
            <Menu label="More actions">
              <MenuItem icon={saved ? "bookmarkBold" : "bookmark"} onClick={() => saveProfile(profile.id)}>{saved ? "Saved" : "Save profile"}</MenuItem>
              <MenuItem icon="link" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/profile/${profile.username}`)}>Copy link</MenuItem>
              <MenuItem icon="flag" onClick={() => setReportOpen(true)}>Report</MenuItem>
              <MenuItem icon="block" danger onClick={() => setConfirmBlock(true)}>Block</MenuItem>
            </Menu>
          )}
        </div>
        <div className="relative mx-auto h-24 w-24 sm:h-28 sm:w-28">
          <div className="relative h-full w-full overflow-hidden rounded-full bg-white ring-4 ring-white shadow-float">
            <Image src={profile.avatar} alt={`${profile.displayName}'s profile photo`} fill sizes="112px" className="object-cover" priority />
          </div>
          {profile.presence === "online" ? <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-white bg-success" /> : null}
        </div>
        <h1 className="mt-3 flex items-center justify-center gap-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
          {profile.displayName}
          {profile.verified ? <Icon name="verified" size={20} className="text-plum" /> : null}
        </h1>
        <p className="text-sm text-muted">@{profile.username}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <Tag tone="muted"><Icon name="pin" size={11} /> {profile.cityLabel}{profile.cityLabel === "Location private" || !profile.country ? "" : `, ${profile.country}`}</Tag>
          {profile.age ? <Tag tone="muted">{profile.age}</Tag> : null}
        </div>

        <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 text-center">
          <Stat label="Posts" value={compact(gallery.length)} />
          <Stat label="Likes" value={compact(likes)} />
          <Stat label="Rating" value={profile.rating ? profile.rating.toFixed(1) : "–"} />
        </div>

        <div className="mx-auto mt-5 flex max-w-sm gap-2">
          {owner ? (
            <>
              <Link href="/dashboard/profile" className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-line hover:bg-canvas"><Icon name="pen" size={16} /> Edit profile</Link>
              <Link href="/dashboard/posts?new=1" className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-plum px-4 text-sm font-semibold text-white hover:bg-plum-deep"><Icon name="galleryAdd" size={17} /> New post</Link>
              <Link href="/dashboard" aria-label="Studio" title="Studio" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white ring-1 ring-line hover:bg-canvas"><Icon name="dashboard" size={19} /></Link>
            </>
          ) : (
            <>
              <Button className="flex-1" onClick={() => orderNow(profile)}>
                <Icon name="bag" size={18} /> Order now
              </Button>
            </>
          )}
        </div>

        {profile.bio ? <p className="mx-auto mt-4 max-w-md text-sm leading-6">{profile.bio}</p> : null}
        {profile.interests.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {profile.interests.map((item) => <Tag key={item} tone="soft" className="px-2.5 py-1 text-xs">{item}</Tag>)}
          </div>
        ) : null}
      </section>

      <div role="tablist" className="sticky top-14 z-20 mt-3 grid grid-cols-3 border-b border-line bg-canvas/95 backdrop-blur lg:top-0">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn("press relative flex h-12 items-center justify-center gap-1.5 text-[13px] font-semibold", tab === item.id ? "text-ink" : "text-muted hover:text-ink")}>
            <Icon name={tab === item.id ? item.activeIcon : item.icon} size={21} />
            <span className="hidden sm:inline">{item.label}</span>
            {item.id === "ratings" && profile.reviewCount > 0 ? <span className="text-xs text-muted">{profile.reviewCount}</span> : null}
            {tab === item.id ? <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-ink" /> : null}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "posts" ? (
          gallery.length ? (
            <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-2xl sm:gap-1">
              {gallery.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`} className="group relative aspect-[3/4] overflow-hidden bg-rose">
                  {post.images[0] ? <Image src={post.images[0]} alt="" fill sizes="(min-width: 768px) 224px, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /> : null}
                  <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/60 to-transparent" />
                  <span className="absolute bottom-1.5 left-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white"><Icon name="heartBold" size={12} /> {compact(post.likeCount)}</span>
                  {post.images.length > 1 ? <Icon name="gallery" size={15} className="absolute right-1.5 top-1.5 text-white drop-shadow" /> : null}
                </Link>
              ))}
            </div>
          ) : <EmptyState icon="gallery" title="No posts yet" body={owner ? "Share your first photo with New post." : "When this profile publishes photos, they will appear here."} />
        ) : null}
        {tab === "ratings" ? (
          <Reviews profile={profile} reviews={detail?.reviews ?? []} canReview={detail?.canReview ?? false} owner={owner} onCreated={() => api<Detail>(`/api/profiles/${username}`).then(setDetail).catch(() => undefined)} />
        ) : null}
        {tab === "about" ? (
          <div className="card divide-y divide-line">
            <AboutRow icon="document" title="Bio" body={profile.bio || "No bio yet."} />
            <AboutRow icon="pin" title="Location" body={profile.cityLabel === "Location private" ? "Kept private by this profile." : `${[profile.cityLabel, profile.country].filter(Boolean).join(", ")}. Exact addresses are never published.`} />
            <AboutRow icon="calendar" title="Joined" body={formatLongDate(profile.joinedAt)} />
            <AboutRow icon="shieldBold" title="Verification" body={profile.verified ? "Age and identity verified by Daylight." : "Waiting for age and identity verification."} />
            <AboutRow icon="star" title="Rating" body={profile.reviewCount > 0 ? `${profile.rating?.toFixed(1)} average from ${profile.reviewCount} verified order${profile.reviewCount === 1 ? "" : "s"}.` : "No ratings yet."} />
          </div>
        ) : null}
      </div>
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="profile" targetId={profile.id} />
      <Dialog open={confirmBlock} title="Block this profile?" onClose={() => setConfirmBlock(false)}>
        <p className="text-sm leading-6 text-muted">You will stop seeing this profile and its posts.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={async () => { await block(profile.id); setConfirmBlock(false); }}>Block</Button>
          <Button variant="outline" className="flex-1" onClick={() => setConfirmBlock(false)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function AboutRow({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="flex gap-3 px-4 py-3.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose text-plum">
        <Icon name={icon} size={16} />
      </span>
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-sm leading-6 text-muted">{body}</p>
      </div>
    </div>
  );
}

function RatingSummary({ rating, reviews }: { rating: number; reviews: PublicReview[] }) {
  return (
    <div className="card flex items-center gap-5 p-4">
      <div className="text-center">
        <p className="text-4xl font-semibold tracking-tight">{rating.toFixed(1)}</p>
        <Stars value={Math.round(rating)} />
        <p className="mt-1 text-xs text-muted">{reviews.length} rating{reviews.length === 1 ? "" : "s"}</p>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {[5, 4, 3, 2, 1].map((n) => {
          const count = reviews.filter((review) => review.rating === n).length;
          return (
            <div key={n} className="flex items-center gap-2 text-[11px] text-muted">
              <span className="w-2">{n}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-plum" style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : "0%" }} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-plum" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name={n <= value ? "starBold" : "star"} size={14} className={n <= value ? "" : "text-line"} />
      ))}
    </span>
  );
}

function Reviews({ profile, reviews, canReview, owner, onCreated }: { profile: PublicProfile; reviews: PublicReview[]; canReview: boolean; owner: boolean; onCreated: () => void }) {
  const { toast, askAuth } = usePlatform();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      await api("/api/social", { method: "POST", body: JSON.stringify({ action: "review", profileId: profile.id, rating, body }) });
      setBody("");
      toast("Rating published");
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.code === "auth_required") askAuth(err.message);
      else setError(err instanceof Error ? err.message : "Could not publish the rating.");
    }
  }

  return (
    <div className="space-y-3">
      {profile.rating ? <RatingSummary rating={profile.rating} reviews={reviews} /> : null}
      {reviews.length === 0 ? <EmptyState icon="star" title="No ratings yet" body="Ratings come only from users after an accepted order." /> : null}
      {reviews.map((review) => (
        <article key={review.id} className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-rose text-sm font-semibold text-plum">{review.authorName.slice(0, 1)}</span>
              <div>
                <h3 className="text-sm font-semibold leading-tight">{review.authorName}</h3>
                <p className="text-xs text-muted">{formatLongDate(review.createdAt)}</p>
              </div>
            </div>
            <Stars value={review.rating} />
          </div>
          <p className="mt-3 text-sm leading-6">{review.body}</p>
          <div className="mt-3 flex items-center justify-between">
            <Tag tone="success"><Icon name="shieldBold" size={12} /> Verified order</Tag>
            <ReportReview reviewId={review.id} />
          </div>
        </article>
      ))}
      {canReview ? (
        <form className="card space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <h3 className="text-sm font-semibold">Rate your order</h3>
          <Field label="Your rating">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setRating(n)} className="press text-plum">
                  <Icon name={n <= rating ? "starBold" : "star"} size={28} className={n <= rating ? "" : "text-line"} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Your rating note" hint="At least 20 characters. One rating per profile.">
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} className={`${controlClass} h-auto py-3`} />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit">Publish rating</Button>
        </form>
      ) : owner ? null : (
        <p className="flex items-start gap-2 px-1 text-[13px] leading-5 text-muted"><Icon name="info" size={16} className="mt-0.5 shrink-0" /> Ratings unlock after the hook accepts your order. Place one with Order now.</p>
      )}
    </div>
  );
}

function ReportReview({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setOpen(true)}>Report</button>
      <ReportDialog open={open} onClose={() => setOpen(false)} targetType="review" targetId={reviewId} />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="card mx-auto max-w-2xl space-y-3 p-6 text-center">
      <Skeleton className="mx-auto h-24 w-24 rounded-full" />
      <Skeleton className="mx-auto h-6 w-40" />
      <Skeleton className="mx-auto h-4 w-56" />
      <Skeleton className="mx-auto h-11 w-full max-w-sm" />
    </div>
  );
}
