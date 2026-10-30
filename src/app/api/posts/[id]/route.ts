import { change } from "@/lib/server/http";
import { openPost, removePost, savePost } from "@/lib/server/social";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return change((db, ctx) => openPost(db, ctx, id));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  return change((db, ctx) => ({ id: savePost(db, ctx, body, id) }));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return change((db, ctx) => {
    removePost(db, ctx, id);
    return { ok: true };
  });
}
