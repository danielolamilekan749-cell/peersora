import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { mutate } from "@/lib/server/db";
import { attachSession, getCtx, jsonError } from "@/lib/server/http";
import { login } from "@/lib/server/social";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const ctx = await getCtx();
    const user = await mutate((db) => login(db, body.email, body.password, ctx.guestId));
    return attachSession(NextResponse.json({ ok: true, role: user.role }), user);
  } catch (error) {
    unstable_rethrow(error);
    return jsonError(error);
  }
}
