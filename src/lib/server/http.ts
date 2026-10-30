import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import type { Database, Role } from "@/lib/types";
import { cookieOptions, readSession, roleCookieOptions, signSession } from "@/lib/server/auth";
import { mutate, readDb } from "@/lib/server/db";
import { DomainError } from "@/lib/server/errors";
import type { Actor } from "@/lib/server/social";

export type Ctx = Actor & { setGuest: string | null };

export async function getCtx(): Promise<Ctx> {
  const jar = await cookies();
  const session = readSession(jar.get("dl_session")?.value);
  const db = readDb();
  const record = session
    ? db.users.find((user) => user.id === session.uid && user.status === "active") ?? null
    : null;
  let guestId = jar.get("dl_guest")?.value ?? null;
  let setGuest: string | null = null;
  if (!record && (!guestId || !guestId.startsWith("guest_"))) {
    guestId = `guest_${randomUUID()}`;
    setGuest = guestId;
  }
  return {
    user: record,
    guestId: record ? guestId : guestId,
    actorId: record ? record.id : guestId || "anon",
    setGuest: record ? null : setGuest,
  };
}

export function jsonError(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function handle(run: (ctx: Ctx) => Promise<unknown> | unknown) {
  try {
    const ctx = await getCtx();
    const data = await run(ctx);
    const response = NextResponse.json(data ?? { ok: true });
    if (ctx.setGuest) response.cookies.set("dl_guest", ctx.setGuest, cookieOptions);
    return response;
  } catch (error) {
    unstable_rethrow(error);
    return jsonError(error);
  }
}

export async function change(run: (db: Database, ctx: Ctx) => unknown) {
  return handle(async (ctx) => mutate((db) => run(db, ctx)));
}

export function attachSession(response: NextResponse, user: { id: string; role: Role }) {
  const token = signSession({
    uid: user.id,
    role: user.role,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
  });
  response.cookies.set("dl_session", token, cookieOptions);
  response.cookies.set("dl_role", user.role, roleCookieOptions);
  return response;
}
