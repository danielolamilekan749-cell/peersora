"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { INTERESTS } from "@/lib/constants";
import { api, uploadImage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatWhen } from "@/lib/format";
import type { NotificationPrefs } from "@/lib/types";
import { Icon, type IconName } from "@/components/icon";
import { PhotoField } from "@/components/join-wizard";
import { usePlatform } from "@/components/platform";
import { Button, controlClass, Dialog, EmptyState, Field, PageTitle, Skeleton, Switch, Tag } from "@/components/ui";

type ManagedComment = { id: string; body: string; hidden: boolean; createdAt: string; authorName: string };
type ManagedPost = {
  id: string;
  images: string[];
  caption: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  visibility: "public" | "hidden";
  frame: "portrait" | "square";
  comments: ManagedComment[];
};

type DashboardData = {
  role: "creator" | "admin";
  account?: {
    email: string;
    fullName: string;
    phone: string;
    deactivated: boolean;
    notificationPrefs: NotificationPrefs;
  };
  profile?: {
    username: string;
    displayName: string;
    bio: string;
    interests: string[];
    avatar: string;
    cover: string;
    city: string;
    region: string;
    country: string;
    locationPrivacy: "city" | "region" | "hidden";
    visibility: "public" | "hidden";
    discoverable: boolean;
    verification: string;
    completion: number;
    likes: number;
  };
  posts?: ManagedPost[];
  stats?: { views: number; likes: number; engagement: number; pendingOrders: number };
  notifications?: { id: string; title: string; body: string; createdAt: string; read: boolean }[];
};

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const next = await api<DashboardData>("/api/me");
    setData(next);
  }

  useEffect(() => {
    reload()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Dashboard unavailable"))
      .finally(() => setLoading(false));
  }, []);

  return { data, error, loading, reload };
}

export function OverviewScreen() {
  const { data, error, loading } = useDashboard();
  if (loading) return <DashboardSkeleton />;
  if (data?.role === "admin") {
    return <EmptyState icon="shieldUser" title="Admin account" body="Platform tools live in the admin dashboard." action={<Link href="/admin" className="press inline-flex h-10 items-center gap-2 rounded-full bg-plum px-4 text-sm font-semibold text-white">Open admin <Icon name="forward" size={16} /></Link>} />;
  }
  if (!data?.profile || !data.stats) return <EmptyState icon="lock" title="Dashboard unavailable" body={error || "Sign in with a creator account."} />;
  const profile = data.profile;
  const stats: { label: string; value: number; icon: IconName }[] = [
    { label: "Profile views", value: data.stats.views, icon: "eyeScan" },
    { label: "Likes", value: data.stats.likes, icon: "like" },
    { label: "Engagement", value: data.stats.engagement, icon: "like" },
    { label: "Pending orders", value: data.stats.pendingOrders, icon: "clipboard" },
  ];
  const approved = profile.verification === "approved";
  return (
    <div>
      <PageTitle
        title={`Hello, ${profile.displayName.split(" ")[0]}`}
        subtitle={`Profile is ${profile.discoverable && approved ? "discoverable" : "private"}.`}
        action={
          <Tag tone={approved ? "success" : "muted"} className="px-2.5 py-1 text-xs">
            <Icon name={approved ? "shieldBold" : "clock"} size={13} /> {approved ? "Verified" : `Verification ${profile.verification}`}
          </Tag>
        }
      />
      {!approved ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-rose px-4 py-3 text-[13px] leading-5 text-plum">
          <Icon name="info" size={18} className="mt-0.5 shrink-0" /> Your profile stays out of discovery until moderation approves the adult and identity check.
        </p>
      ) : null}
      <section className="card mt-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-rose ring-4 ring-canvas">
          {profile.avatar ? <Image src={profile.avatar} alt="" fill sizes="64px" className="object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Profile completion</span>
            <span className="font-semibold text-plum">{profile.completion}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/70">
            <div className="h-full rounded-full bg-plum transition-all" style={{ width: `${profile.completion}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">Photos, a bio, and three interests help visitors understand you quickly.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/profile" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-plum px-4 text-[13px] font-semibold text-white"><Icon name="pen" size={15} /> Edit profile</Link>
          <Link href={`/profile/${profile.username}`} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold ring-1 ring-line"><Icon name="eye" size={15} /> Preview</Link>
        </div>
      </section>
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="card p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose text-plum">
              <Icon name={item.icon} size={18} />
            </span>
            <dd className="mt-3 text-2xl font-semibold tracking-tight">{item.value}</dd>
            <dt className="text-xs text-muted">{item.label}</dt>
          </div>
        ))}
      </dl>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <div className="card mt-3 divide-y divide-line">
          {(data.notifications ?? []).slice(0, 5).map((item) => (
            <article key={item.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose text-plum"><Icon name="bell" size={16} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="text-[13px] text-muted">{item.body}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">{formatWhen(item.createdAt)}</span>
            </article>
          ))}
          {(data.notifications ?? []).length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">No activity yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
      </div>
    </div>
  );
}

export function ProfileEditor() {
  const { data, loading, reload } = useDashboard();
  const { toast } = usePlatform();
  const [form, setForm] = useState<DashboardData["profile"] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.profile) setForm(data.profile);
  }, [data]);

  if (loading) return <DashboardSkeleton />;
  if (data?.role === "admin" || !form) {
    return <EmptyState icon="lock" title="Hook profile required" body="This editor is for hook accounts. Join as a hook to create one." />;
  }

  async function save(extra: Record<string, unknown> = {}) {
    if (!form) return;
    setBusy(true);
    try {
      await api("/api/me", { method: "PATCH", body: JSON.stringify({ ...form, ...extra }) });
      toast("Profile updated");
      await reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function photo(file: File | undefined, key: "avatar" | "cover") {
    if (!file) return;
    const url = await uploadImage(file);
    setForm((current) => {
      if (!current) return current;
      return key === "avatar" ? { ...current, avatar: url } : { ...current, cover: url };
    });
  }

  return (
    <div>
      <PageTitle title="My profile" subtitle="What visitors see once your profile is approved." />
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-4">
          <section className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon name="camera" size={18} className="text-plum" /> Photos</h2>
            <PhotoField label="Profile photo" shape="round" url={form.avatar} onFile={(file) => photo(file, "avatar")} />
            <PhotoField label="Cover photo" shape="wide" url={form.cover} onFile={(file) => photo(file, "cover")} hint="JPG, PNG, or WebP up to 4MB." />
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon name="user" size={18} className="text-plum" /> About you</h2>
            <Field label="Display name"><input className={controlClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
            <Field label="Biography" hint={`${form.bio.length}/280`}><textarea className={`${controlClass} h-auto py-3`} rows={4} maxLength={280} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></Field>
            <Field label="Interests" hint="Pick up to eight.">
              <span className="flex flex-wrap gap-2">
                {INTERESTS.map((item) => {
                  const on = form.interests.includes(item);
                  return (
                    <button type="button" key={item} aria-pressed={on} onClick={() => setForm({ ...form, interests: on ? form.interests.filter((interest) => interest !== item) : [...form.interests, item].slice(0, 8) })} className={cn("press inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium", on ? "bg-plum text-white" : "bg-white ring-1 ring-line hover:bg-canvas")}>
                      {on ? <Icon name="check" size={14} /> : null}
                      {item}
                    </button>
                  );
                })}
              </span>
            </Field>
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon name="pin" size={18} className="text-plum" /> Location</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="City"><input className={controlClass} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
              <Field label="Region"><input className={controlClass} value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></Field>
              <Field label="Country"><input className={controlClass} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
            </div>
            <Field label="What visitors can see">
              <select className={controlClass} value={form.locationPrivacy} onChange={(event) => setForm({ ...form, locationPrivacy: event.target.value as typeof form.locationPrivacy })}>
                <option value="city">City and country</option>
                <option value="region">Region only</option>
                <option value="hidden">Hidden</option>
              </select>
            </Field>
          </section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className="card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon name="shield" size={18} className="text-plum" /> Privacy</h2>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="block font-medium">Public profile</span>
                <span className="block text-xs text-muted">Visible by link once approved.</span>
              </span>
              <Switch checked={form.visibility === "public"} onChange={(event) => setForm({ ...form, visibility: event.target.checked ? "public" : "hidden" })} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="block font-medium">Appear in discovery</span>
                <span className="block text-xs text-muted">Listed in the feed and explore after verification.</span>
              </span>
              <Switch checked={form.discoverable} onChange={(event) => setForm({ ...form, discoverable: event.target.checked })} />
            </label>
          </section>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => save()} className="flex-1">{busy ? "Saving" : "Save profile"}</Button>
            <Link href={`/profile/${form.username}`} className="press inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-line"><Icon name="eye" size={16} /> Preview</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function PostsManager() {
  const { data, loading, reload } = useDashboard();
  const { toast } = usePlatform();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [frame, setFrame] = useState<"portrait" | "square">("portrait");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (loading) return <DashboardSkeleton />;
  if (data?.role === "admin") {
    return <EmptyState icon="lock" title="Hook profile required" body="Posts are managed from a hook account." />;
  }
  const posts = data?.posts ?? [];

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const uploaded: string[] = [];
    for (const file of Array.from(list).slice(0, 10)) uploaded.push(await uploadImage(file));
    setImages((current) => [...current, ...uploaded].slice(0, 10));
  }

  async function save() {
    const payload = { caption, images, frame, visibility: "public" };
    if (editing) await api(`/api/posts/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
    else await api("/api/posts", { method: "POST", body: JSON.stringify(payload) });
    setOpen(false);
    setCaption("");
    setImages([]);
    setEditing(null);
    toast("Post saved");
    await reload();
  }

  return (
    <div>
      <PageTitle
        title="My posts"
        subtitle={`${posts.length} post${posts.length === 1 ? "" : "s"} · hidden posts stay off the public feed`}
        action={
          <Button onClick={() => { setEditing(null); setCaption(""); setImages([]); setOpen(true); }}>
            <Icon name="galleryAdd" size={18} /> New post
          </Button>
        }
      />
      <div className="mt-5 space-y-3">
        {posts.length === 0 ? <EmptyState icon="gallery" title="No posts yet" body="Share a photo and a caption. Hidden posts stay off the public feed." /> : null}
        {posts.map((post) => (
          <article key={post.id} className="card grid gap-4 p-3 sm:grid-cols-[128px_1fr]">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-rose sm:h-32 sm:w-32">
              {post.images[0] ? <Image src={post.images[0]} alt="" fill sizes="128px" className="object-cover" /> : null}
              {post.visibility === "hidden" ? <span className="absolute inset-0 grid place-items-center bg-ink/50 text-white"><Icon name="eyeClosed" size={22} /></span> : null}
              {post.images.length > 1 ? <span className="absolute right-2 top-2 rounded-full bg-ink/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{post.images.length}</span> : null}
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-6">{post.caption}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1"><Icon name="heart" size={13} /> {post.likeCount}</span>
                <span className="inline-flex items-center gap-1"><Icon name="comment" size={13} /> {post.commentCount}</span>
                <Tag tone={post.visibility === "public" ? "success" : "muted"}>{post.visibility}</Tag>
                <span>{formatWhen(post.createdAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => { setEditing(post.id); setCaption(post.caption); setImages(post.images); setFrame(post.frame); setOpen(true); }}><Icon name="pen" size={14} /> Edit</Button>
                <Button size="sm" variant="outline" onClick={async () => { await api(`/api/posts/${post.id}`, { method: "PATCH", body: JSON.stringify({ caption: post.caption, images: post.images, frame: post.frame, visibility: post.visibility === "public" ? "hidden" : "public" }) }); await reload(); }}>
                  <Icon name={post.visibility === "public" ? "eyeClosed" : "eye"} size={14} /> {post.visibility === "public" ? "Hide" : "Show"}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(post.id)}><Icon name="trash" size={14} /> Delete</Button>
              </div>
              {post.comments.length > 0 ? (
                <div className="mt-3 space-y-1.5 rounded-xl bg-canvas p-3">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="flex items-start justify-between gap-3 text-[13px]">
                      <p className={comment.hidden ? "text-muted line-through" : ""}><span className="font-medium">{comment.authorName}</span> {comment.body}</p>
                      {!comment.hidden ? <button type="button" className="shrink-0 text-xs text-muted hover:text-ink" onClick={async () => { await api("/api/social", { method: "POST", body: JSON.stringify({ action: "hide-comment", id: comment.id }) }); await reload(); }}>Hide</button> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <Dialog open={open} title={editing ? "Edit post" : "New post"} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Field label="Photos" hint="Up to 10 photos. People swipe through them. JPG, PNG, or WebP.">
            <span className="flex flex-wrap gap-2">
              {images.map((image, imageIndex) => (
                <span key={image} className="relative h-20 w-20 overflow-hidden rounded-xl ring-1 ring-line">
                  <Image src={image} alt="" fill sizes="80px" className="object-cover" />
                  <button type="button" aria-label="Remove photo" onClick={() => setImages(images.filter((_, i) => i !== imageIndex))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white"><Icon name="close" size={14} /></button>
                </span>
              ))}
              {images.length < 10 ? (
                <span className="press grid h-20 w-20 cursor-pointer place-items-center rounded-xl bg-canvas text-muted ring-1 ring-dashed ring-line hover:text-ink">
                  <Icon name="addCircle" size={24} />
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => addFiles(event.target.files)} />
                </span>
              ) : null}
            </span>
          </Field>
          <Field label="Caption"><textarea className={`${controlClass} h-auto py-3`} rows={4} value={caption} onChange={(event) => setCaption(event.target.value)} /></Field>
          <Field label="Frame">
            <div className="flex rounded-full bg-canvas p-1">
              {(["portrait", "square"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setFrame(item)} className={cn("press flex-1 rounded-full py-2 text-[13px] font-medium capitalize", frame === item ? "bg-white shadow-sm" : "text-muted")}>{item}</button>
              ))}
            </div>
          </Field>
          <Button onClick={save} disabled={!caption.trim() || images.length === 0} className="w-full">Save post</Button>
        </div>
      </Dialog>
      <Dialog open={Boolean(confirmDelete)} title="Delete this post?" onClose={() => setConfirmDelete(null)}>
        <p className="text-sm leading-6 text-muted">Likes and comments on it will be removed.</p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" variant="danger" onClick={async () => { if (confirmDelete) { await api(`/api/posts/${confirmDelete}`, { method: "DELETE" }); setConfirmDelete(null); await reload(); } }}>Delete</Button>
          <Button className="flex-1" variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  );
}
