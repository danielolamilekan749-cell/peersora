import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { mutate } from "@/lib/server/db";
import { attachSession, getCtx, jsonError } from "@/lib/server/http";
import { DomainError } from "@/lib/server/errors";
import { googleSignIn } from "@/lib/server/social";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type SupabaseUser = {
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: { full_name?: string; name?: string };
};

/** Asks Supabase who owns this access token. The email is never taken from the client. */
async function verifiedGoogleUser(accessToken: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey ?? "", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new DomainError("Your Google sign-in expired. Please try again.", "auth", 401);
  const user = (await response.json()) as SupabaseUser;
  if (!user.email || !user.email_confirmed_at) {
    throw new DomainError("Your Google email could not be verified.", "auth", 401);
  }
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0];
  return { email: user.email, name: fullName };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ctx = await getCtx();

    let input = body;
    if (supabaseUrl && supabaseKey) {
      // Real mode: only a token verified by Supabase can sign anyone in.
      if (typeof body.accessToken !== "string" || body.accessToken.length < 20) {
        throw new DomainError("Continue with Google to sign in.", "auth", 401);
      }
      const verified = await verifiedGoogleUser(body.accessToken);
      input = { ...verified, intent: body.intent, adult: body.adult };
    }

    const { user, created } = await mutate((db) => googleSignIn(db, input, ctx.guestId));
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
