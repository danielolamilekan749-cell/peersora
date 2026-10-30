import { readDb } from "@/lib/server/db";
import { change, handle } from "@/lib/server/http";
import { dashboard, memberHome, memberSettings, updateAccount } from "@/lib/server/social";

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get("view");
  return handle((ctx) => {
    const db = readDb();
    if (view === "settings") return memberSettings(db, ctx);
    if (view === "member") return memberHome(db, ctx);
    return dashboard(db, ctx);
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  return change((db, ctx) => {
    updateAccount(db, ctx, body);
    return { ok: true };
  });
}
