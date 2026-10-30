import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase keys are configured, which turns on real Google sign-in. */
export const supabaseEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Browser client. Only used for the Google OAuth redirect and code exchange. */
export function supabaseBrowser(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase is not configured.");
  client ??= createClient(url, anonKey, {
    auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true },
  });
  return client;
}
