import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { mutate } from "@/lib/server/db";
import { attachSession, getCtx, jsonError } from "@/lib/server/http";
import { googleSignIn } from "@/lib/server/social";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ctx = await getCtx();
    const { user, created } = await mutate((db) => googleSignIn(db, body, ctx.guestId));
    const profile = await mutate((db) => db.profiles.find((item) => item.userId === user.id));
    return attachSession(
      NextResponse.json({ ok: true, role: user.role, created, hasProfile: Boolean(profile) }),
      user,
    );
  } catch (error) {
    unstable_rethrow(error);
    return jsonError(error);
  }
}
