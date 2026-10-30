"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { supabaseBrowser, supabaseEnabled } from "@/lib/supabase-browser";
import { Button, controlClass, Dialog, Field } from "@/components/ui";

// The name-and-email stand-in exists only for local development without Supabase.
const previewAllowed = process.env.NODE_ENV !== "production";

export const GOOGLE_INTENT_KEY = "daylight.google";

export type GoogleResult = { role: string; created: boolean; hasProfile: boolean };

function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/**
 * "Continue with Google". With Supabase connected this calls
 * supabase.auth.signInWithOAuth({ provider: "google" }). In local preview there is
 * no Google client, so the button asks for the name and email of the account and
 * creates the same kind of account the database trigger would.
 */
export function GoogleButton({
  intent,
  label = "Continue with Google",
  onDone,
}: {
  intent: "user" | "hook";
  label?: string;
  onDone: (result: GoogleResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  async function startGoogle() {
    setError("");
    setRedirecting(true);
    try {
      sessionStorage.setItem(
        GOOGLE_INTENT_KEY,
        JSON.stringify({ intent, next: new URLSearchParams(window.location.search).get("next") ?? "" }),
      );
      // A provider that is switched off in Supabase would otherwise show a raw JSON error page.
      const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
      if (settings && settings.external?.google === false) {
        throw new Error("Google sign-in is not switched on yet. Enable it in Supabase under Authentication, Providers, Google.");
      }
      const { error: oauthError } = await supabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setRedirecting(false);
      setError(err instanceof Error ? err.message : "Could not start Google sign-in.");
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await api<GoogleResult>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ name, email, intent, adult: true }),
      });
      setOpen(false);
      onDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue with Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (supabaseEnabled) startGoogle();
          else if (previewAllowed) setOpen(true);
          else setError("Google sign-in is not configured on this site yet.");
        }}
        disabled={redirecting}
        className="press inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-[15px] font-semibold text-ink ring-1 ring-line shadow-card hover:bg-canvas disabled:opacity-70"
      >
        <GoogleMark /> {redirecting ? "Opening Google" : label}
      </button>
      {error ? <p className="mt-3 text-center text-sm text-danger">{error}</p> : null}
      <p className="mt-3 text-center text-[11px] leading-5 text-muted">
        By continuing you confirm you are 18 or over and accept the{" "}
        <Link href="/terms" className="font-medium text-plum">Terms</Link> and{" "}
        <Link href="/privacy" className="font-medium text-plum">Privacy Policy</Link>.
      </p>
      <Dialog open={open} title="Choose your Google account" onClose={() => setOpen(false)}>
        <form
          className="space-y-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p className="flex items-start gap-2 rounded-xl bg-rose px-3.5 py-3 text-[13px] leading-5 text-plum">
            <GoogleMark size={16} />
            <span>Local preview. Real Google sign-in turns on when Supabase Auth is connected. Enter the name and email to use.</span>
          </p>
          <Field label="Name">
            <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus />
          </Field>
          <Field label="Gmail address">
            <input type="email" className={controlClass} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy || !email || name.trim().length < 2}>
            {busy ? "Please wait" : "Continue"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
