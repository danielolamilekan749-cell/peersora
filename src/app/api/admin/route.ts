import { readDb } from "@/lib/server/db";
import { change, handle } from "@/lib/server/http";
import { adminAct, adminOverview } from "@/lib/server/social";

export async function GET() {
  return handle((ctx) => adminOverview(readDb(), ctx));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });
  return change((db, ctx) => {
    adminAct(db, ctx, body);
    return adminOverview(db, ctx);
  });
}
