"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/format";
import type { GivenRating, PublicPost, PublicProfile } from "@/lib/types";
import { Icon } from "@/components/icon";
import { ProfileCard } from "@/components/discovery";
import { usePlatform } from "@/components/platform";
import { Button, EmptyState, Skeleton } from "@/components/ui";

type Home = {
  account: { fullName: string; email: string; avatar: string; joinedAt: string; role: string };
  savedPosts: PublicPost[];
  ratings: GivenRating[];
  orders: number;
};

type TabId = "saved" | "ratings";

export function MeScreen() {
  const router = useRouter();
  const { viewer, askJoin, refresh, loading: platformLoading } = usePlatform();
  const [data, setData] = useState<Home | null>(null);
  const [tab, setTab] = useState<TabId>("saved");
  const signedIn = Boolean(viewer && viewer.role !== "guest");

  useEffect(() => {
    if (!signedIn) return;
    api<Home>("/api/me?view=member")
      .then(setData)
      .catch(() => setData(null));
  }, [signedIn]);

  if (!signedIn && !platformLoading) {
    return (
      <div className="pt-3 lg:max-w-xl lg:pt-0">
        <EmptyState icon="user" title="Join to get your profile" body="Save posts, place orders, and rate." action={<Button onClick={askJoin}>Join Daylight</Button>} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 pt-3 lg:pt-0">
        <Skeleton className="h-56" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  const initial = data.account.fullName.trim().slice(0, 1).toUpperCase() || "U";
  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "saved", label: "Saved", count: data.savedPosts.length },
    { id: "ratings", label: "Ratings given", count: data.ratings.length },
  ];

  return (
    <div className="mx-auto max-w-2xl pt-3 lg:pt-0">
      <section className="card relative overflow-hidden px-4 pb-5 pt-7 text-center">
        <span className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-rose to-transparent" />
        <Link href="/settings" aria-label="Settings" title="Settings" className="press absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-canvas">
          <Icon name="settings" size={22} />
        </Link>
        <span className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-plum text-4xl font-semibold text-white ring-4 ring-white shadow-float">{initial}</span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{data.account.fullName}</h1>
        <p className="text-sm text-muted">User · joined {formatLongDate(data.account.joinedAt)}</p>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 text-center">
          <Stat label="Saved" value={data.savedPosts.length} />
          <Stat label="Ratings" value={data.ratings.length} />
          <Stat label="Orders" value={data.orders} />
        </div>
        <div className="mx-auto mt-5 flex max-w-sm gap-2">
          <Link href="/orders" className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-plum text-sm font-semibold text-white hover:bg-plum-deep"><Icon name="clipboard" size={18} /> My orders</Link>
          <Button
            variant="outline"
            className="flex-1"
            onClick={async () => {
              await api("/api/auth/logout", { method: "POST" });
              await refresh();
              router.push("/");
              router.refresh();
            }}
          >
            <Icon name="logout" size={18} /> Sign out
          </Button>
        </div>
      </section>

      <div role="tablist" className="sticky top-14 z-20 mt-3 grid grid-cols-2 border-b border-line bg-canvas/95 backdrop-blur lg:top-0">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn("press relative flex h-12 items-center justify-center gap-1.5 text-[13px] font-semibold", tab === item.id ? "text-ink" : "text-muted hover:text-ink")}>
            {item.label} <span className="text-xs font-medium text-muted">{item.count}</span>
            {tab === item.id ? <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-ink" /> : null}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "saved" ? (
          data.savedPosts.length ? (
            <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-2xl sm:gap-1">
              {data.savedPosts.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`} className="relative aspect-[3/4] overflow-hidden bg-rose">
                  {post.images[0] ? <Image src={post.images[0]} alt="" fill sizes="(min-width: 768px) 224px, 33vw" className="object-cover" /> : null}
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon="bookmark" title="No saved posts" body="Tap the bookmark under a post to keep it in Saved." />
          )
        ) : null}
        {tab === "ratings" ? (
          data.ratings.length ? (
            <div className="space-y-2.5">
              {data.ratings.map((rating) => (
                <Link key={rating.id} href={`/profile/${rating.profile.username}?tab=ratings`} className="card flex gap-3 p-3.5">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-rose">
                    {rating.profile.avatar ? <Image src={rating.profile.avatar} alt="" fill sizes="44px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{rating.profile.displayName}</span>
                      <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-plum"><Icon name="starBold" size={14} /> {rating.rating}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-muted">{rating.body}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon="ratings" title="No ratings given" body="After a hook accepts your order you can rate them from their profile." />
          )
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
