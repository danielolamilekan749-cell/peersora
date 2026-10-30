"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { GOOGLE_INTENT_KEY } from "@/components/google-button";

/**
 * Landing page after Google. Exchanges the code for a Supabase session, hands the
 * access token to our server (which verifies it with Supabase), then continues.
 */
export function GoogleCallback() {
  const params = useSearchParams();
  const ran = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      const providerError = params.get("error_description") || params.get("error");
      if (providerError) throw new Error(providerError);
      const code = params.get("code");
      if (!code) throw new Error("Google did not return a sign-in code. Please try again.");

      const supabase = supabaseBrowser();
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError || !data.session) throw new Error(exchangeError?.message ?? "Could not finish Google sign-in.");

      let intent: "user" | "hook" = "user";
      let next = "";
      try {
        const saved = JSON.parse(sessionStorage.getItem(GOOGLE_INTENT_KEY) ?? "{}") as { intent?: string; next?: string };
        if (saved.intent === "hook") intent = "hook";
        if (saved.next && saved.next.startsWith("/") && !saved.next.startsWith("//")) next = saved.next;
      } catch {
        // ignore malformed storage
      }
      sessionStorage.removeItem(GOOGLE_INTENT_KEY);

      const result = await api<{ role: string; hasProfile: boolean }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ accessToken: data.session.access_token, intent, adult: true }),
      });
      // The app keeps its own session cookie, so the Supabase one is not needed here.
      await supabase.auth.signOut({ scope: "local" });

      let target = next || "/";
      if (result.role === "admin") target = "/admin";
      else if (result.role === "creator" && !result.hasProfile) target = "/join?as=hook";
      else if (intent === "hook" && result.role === "creator") target = result.hasProfile ? "/dashboard/posts" : "/join?as=hook";
      window.location.replace(target);
    }

    run().catch((err) => setError(err instanceof Error ? err.message : "Could not finish Google sign-in."));
  }, [params]);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-card ring-1 ring-line">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">Google sign-in did not finish</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
            <Link href="/join" className="press mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-plum text-sm font-semibold text-white">
              Try again
            </Link>
          </>
        ) : (
          <>
            <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-4 border-line border-t-plum" />
            <p className="mt-4 text-sm font-medium">Signing you in</p>
          </>
        )}
      </div>
    </main>
  );
}
