import { readDb } from "@/lib/server/db";
import { change, handle } from "@/lib/server/http";
import { markNotifications, notificationsFor } from "@/lib/server/social";

export async function GET() {
  return handle((ctx) => notificationsFor(readDb(), ctx));
}

export async function POST() {
  return change((db, ctx) => {
    markNotifications(db, ctx);
    return notificationsFor(db, ctx);
  });
}
