import { change } from "@/lib/server/http";
import { submitAppeal } from "@/lib/server/social";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  return change((db, _ctx) => {
    submitAppeal(db, body);
    return { ok: true };
  });
}
