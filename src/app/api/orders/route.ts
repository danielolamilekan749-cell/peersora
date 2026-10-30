import { DomainError } from "@/lib/server/errors";
import { readDb } from "@/lib/server/db";
import { change, handle } from "@/lib/server/http";
import { listOrders, placeOrder, respondOrder } from "@/lib/server/social";

export async function GET() {
  return handle((ctx) => listOrders(readDb(), ctx));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const action = body.action;
  return change((db, ctx) => {
    if (action === "place") return { ok: true, id: placeOrder(db, ctx, body) };
    if (typeof body.id !== "string") throw new DomainError("Order not found.", "missing", 404);
    respondOrder(db, ctx, body.id, action);
    return { ok: true };
  });
}
