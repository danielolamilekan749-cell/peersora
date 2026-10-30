import { change } from "@/lib/server/http";
import { completeHookProfile } from "@/lib/server/social";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  return change((db, ctx) => {
    const profile = completeHookProfile(db, ctx, body);
    return { ok: true, username: profile.username };
  });
}
