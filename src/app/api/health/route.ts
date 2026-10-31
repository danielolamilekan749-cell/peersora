import { createClient } from "@supabase/supabase-js";
import { connection, NextResponse } from "next/server";

/**
 * Setup check: open /api/health on the live site. It reports which settings are
 * present (never their values) and whether the server can reach the database.
 */
export async function GET() {
  await connection();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const settings = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(url),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16),
    CLOUDINARY_URL: Boolean(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_API_SECRET),
    ADMIN_EMAILS: Boolean(process.env.ADMIN_EMAILS),
  };

  let database: { ok: boolean; problem?: string } = { ok: false, problem: "Supabase URL or service key is missing." };
  if (url && serviceKey) {
    const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const checks = ["accounts", "profiles", "posts", "post_images", "orders", "reviews"];
    const problems: string[] = [];
    for (const table of checks) {
      const { error } = await client.from(table).select("*", { head: true, count: "exact" }).limit(1);
      if (error) problems.push(`${table}: ${error.message}`.slice(0, 140));
    }
    const images = await client.from("post_images").select("post_id,position").limit(1);
    if (images.error) problems.push(`post_images columns: ${images.error.message}`.slice(0, 140));
    database = problems.length ? { ok: false, problem: problems.join(" | ") } : { ok: true };
  }

  const ready = Object.entries(settings).every(([name, set]) => set || name === "ADMIN_EMAILS" || name === "CLOUDINARY_URL") && database.ok;
  return NextResponse.json({ ready, settings, database }, { status: ready ? 200 : 503 });
}
