"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatLongDate, formatWhen } from "@/lib/format";
import type { PublicComment, PublicPost, PublicProfile } from "@/lib/types";
import { ReportDialog, share } from "@/components/discovery";
import { Icon } from "@/components/icon";
import { usePlatform } from "@/components/platform";
import { Avatar, EmptyState, Menu, MenuItem, Skeleton } from "@/components/ui";

type Payload = {
  post: PublicPost;
  comments: PublicComment[];
  profile: PublicProfile;
};

export function PostScreen({ id }: { id: string }) {
  const { posts, like, savePost, viewer, askAuth, toast } = usePlatform();
  const known = posts.find((post) => post.id === id);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [index, setIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  function load() {
    return api<Payload>(`/api/posts/${id}`).then(setData).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Post unavailable");
    });
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
    // load identity changes with id only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const post = data?.post ?? known;
  if (!post && loading) {
    return <Skeleton className="mx-auto h-[70vh] max-w-4xl" />;
  }
  if (!post) return <EmptyState icon="gallery" title="Post unavailable" body={error || "This post is hidden or no longer public."} />;
  const postId = post.id;
  const liked = viewer?.likes.includes(postId);
  const saved = viewer?.savedPosts.includes(post.id);
  const image = post.images[index] ?? post.images[0];
  const comments = data?.comments ?? [];

  async function comment() {
    try {
      await api("/api/social", { method: "POST", body: JSON.stringify({ action: "comment", id: postId, body }) });
      setBody("");
      await load();
      toast("Comment added");
    } catch (err) {
      if (err instanceof ApiError && err.code === "auth_required") askAuth(err.message);
      else toast(err instanceof Error ? err.message : "Could not comment");
    }
  }

  return (
    <div className="mx-auto max-w-4xl pt-3 lg:pt-0">
      <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <Icon name="back" size={18} /> Back to feed
      </Link>
      <article className="card grid overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="relative bg-canvas">
          <div className={cn("relative", post.frame === "square" ? "aspect-square" : "aspect-[4/5]", "lg:min-h-[560px]")}>
            {image ? <Image src={image} alt={`Post by ${post.displayName}`} fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" priority /> : null}
          </div>
          {post.images.length > 1 ? (
            <>
              <span className="absolute right-3 top-3 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{index + 1}/{post.images.length}</span>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {post.images.map((item, imageIndex) => (
                  <button key={item} type="button" aria-label={`Photo ${imageIndex + 1}`} onClick={() => setIndex(imageIndex)} className={cn("h-1.5 rounded-full transition-all", imageIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/60")} />
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div className="flex flex-col">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Link href={`/profile/${post.username}`}>
              <Avatar src={post.avatar} size={40} ring />
            </Link>
            <div className="min-w-0 flex-1 leading-tight">
              <Link href={`/profile/${post.username}`} className="flex items-center gap-1 text-sm font-semibold">
                <span className="truncate">{post.username}</span>
                {data?.profile.verified ? <Icon name="verified" size={14} className="text-plum" /> : null}
              </Link>
              <p className="truncate text-xs text-muted">{post.displayName}{post.sample ? " · Sample post" : ""}</p>
            </div>
            <Menu label="Post actions">
              <MenuItem icon="link" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy link</MenuItem>
              <MenuItem icon="flag" onClick={() => setReportOpen(true)}>Report post</MenuItem>
            </Menu>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 lg:max-h-[420px]">
            <div className="flex gap-3">
              <Avatar src={post.avatar} size={32} />
              <p className="text-sm leading-6">
                <Link href={`/profile/${post.username}`} className="font-semibold">{post.username}</Link> {post.caption}
                <span className="mt-0.5 block text-xs text-muted">{formatLongDate(post.createdAt)}</span>
              </p>
            </div>
            {comments.length === 0 ? (
              <p className="rounded-xl bg-canvas px-3 py-2.5 text-[13px] text-muted">No comments yet. Start the conversation.</p>
            ) : (
              comments.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose text-xs font-semibold text-plum">{item.authorName.slice(0, 1)}</span>
                  <p className="text-sm leading-6">
                    <span className="font-semibold">{item.authorName}</span> {item.body}
                    <span className="mt-0.5 block text-xs text-muted">{formatWhen(item.createdAt)}</span>
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-line px-4 pb-3 pt-2">
            <div className="flex items-center gap-1">
              <button type="button" aria-pressed={liked} aria-label="Like" onClick={() => like(post.id)} className={cn("press grid h-10 w-10 place-items-center rounded-full hover:bg-canvas", liked && "text-plum")}>
                <Icon name={liked ? "heartBold" : "heart"} size={26} />
              </button>
              <button type="button" aria-label="Comment" onClick={() => document.getElementById("comment")?.focus()} className="press grid h-10 w-10 place-items-center rounded-full hover:bg-canvas">
                <Icon name="comment" size={26} />
              </button>
              <button type="button" aria-label="Share" onClick={() => share(`/posts/${post.id}`)} className="press grid h-10 w-10 place-items-center rounded-full hover:bg-canvas">
                <Icon name="send" size={24} />
              </button>
              <button type="button" aria-pressed={saved} aria-label="Save" onClick={() => savePost(post.id)} className={cn("press ml-auto grid h-10 w-10 place-items-center rounded-full hover:bg-canvas", saved && "text-plum")}>
                <Icon name={saved ? "bookmarkBold" : "bookmark"} size={26} />
              </button>
            </div>
            <p className="px-1 text-sm font-semibold">{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</p>
            <p className="px-1 text-[11px] uppercase tracking-wide text-muted">{formatWhen(post.createdAt)}</p>
          </div>
          <form className="flex items-center gap-2 border-t border-line px-3 py-2.5" onSubmit={(event) => { event.preventDefault(); comment(); }}>
            <label className="sr-only" htmlFor="comment">Comment</label>
            <input id="comment" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add a comment" className="h-10 min-w-0 flex-1 rounded-full bg-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:ring-plum" />
            <button type="submit" disabled={!body.trim()} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum text-white disabled:opacity-40">
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
        <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="post" targetId={post.id} />
      </article>
    </div>
  );
}
