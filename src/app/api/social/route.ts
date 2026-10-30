import { DomainError } from "@/lib/server/errors";
import { change } from "@/lib/server/http";
import {
  addComment,
  blockProfile,
  buildViewer,
  reportContent,
  reviewProfile,
  setCommentHidden,
  toggleLike,
  toggleSave,
  unblock,
} from "@/lib/server/social";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  return change((db, ctx) => {
    const id = typeof body.id === "string" ? body.id : "";
    if (body.action === "save-profile") toggleSave(db, ctx, "profile", id, true);
    else if (body.action === "unsave-profile") toggleSave(db, ctx, "profile", id, false);
    else if (body.action === "save-post") toggleSave(db, ctx, "post", id, true);
    else if (body.action === "unsave-post") toggleSave(db, ctx, "post", id, false);
    else if (body.action === "like") toggleLike(db, ctx, id, true);
    else if (body.action === "unlike") toggleLike(db, ctx, id, false);
    else if (body.action === "comment") addComment(db, ctx, id, body.body);
    else if (body.action === "hide-comment") setCommentHidden(db, ctx, id, true);
    else if (body.action === "block") blockProfile(db, ctx, id);
    else if (body.action === "unblock") unblock(db, ctx, id);
    else if (body.action === "report") reportContent(db, ctx, body);
    else if (body.action === "review") reviewProfile(db, ctx, body);
    else throw new DomainError("Unknown action.");
    return { ok: true, viewer: buildViewer(db, ctx) };
  });
}
