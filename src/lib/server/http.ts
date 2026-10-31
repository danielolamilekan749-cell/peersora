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

type Jar = Awaited<ReturnType<typeof cookies>>;

/** Who is making this request, worked out from the cookie and the loaded data. */
function ctxFrom(db: Database, jar: Jar): Ctx {
  const session = readSession(jar.get("dl_session")?.value);
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
    guestId,
    actorId: record ? record.id : guestId || "anon",
    setGuest: record ? null : setGuest,
  };
}

/** The signed-in user for an API route that does not load the database itself. */
export async function sessionUserId() {
  const jar = await cookies();
  return readSession(jar.get("dl_session")?.value)?.uid ?? null;
}

export function jsonError(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

function finish(ctx: Ctx, data: unknown) {
  const response = NextResponse.json(data ?? { ok: true });
  if (ctx.setGuest) response.cookies.set("dl_guest", ctx.setGuest, cookieOptions);
  return response;
}

/** Read-only request: loads the data once and answers from it. */
export async function handle(run: (db: Database, ctx: Ctx) => Promise<unknown> | unknown) {
  try {
    const jar = await cookies();
    const db = await readDb();
    const ctx = ctxFrom(db, jar);
    return finish(ctx, await run(db, ctx));
  } catch (error) {
    unstable_rethrow(error);
    return jsonError(error);
  }
}

/** Request that changes data: only the rows it touched are saved. */
export async function change(run: (db: Database, ctx: Ctx) => unknown) {
  try {
    const jar = await cookies();
    let ctx: Ctx | null = null;
    const data = await mutate((db) => {
      ctx = ctxFrom(db, jar);
      return run(db, ctx);
    });
    return finish(ctx as unknown as Ctx, data);
  } catch (error) {
    unstable_rethrow(error);
    return jsonError(error);
  }
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
