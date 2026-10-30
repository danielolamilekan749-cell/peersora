"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DEMO_PASSWORD } from "@/lib/constants";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { GoogleButton, type GoogleResult } from "@/components/google-button";
import { Icon } from "@/components/icon";
import { usePlatform } from "@/components/platform";
import { Button, controlClass, Field } from "@/components/ui";

const demoAccounts = [
  { label: "Hook", email: "amara@daylight.demo", icon: "camera" as const },
  { label: "Pending hook", email: "nora@daylight.demo", icon: "clock" as const },
  { label: "User", email: "james@daylight.demo", icon: "user" as const },
  { label: "Admin", email: "admin@daylight.demo", icon: "shieldUser" as const },
];

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = usePlatform();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [suspended, setSuspended] = useState(false);
  const [appeal, setAppeal] = useState("");
  const [busy, setBusy] = useState(false);
  const notice = params.get("notice");

  async function go(role: string, hasProfile = true) {
    await refresh();
    const next = params.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) router.push(next);
    else if (role === "admin") router.push("/admin");
    else if (role === "creator" && !hasProfile) router.push("/join?as=hook");
    else router.push("/");
    router.refresh();
  }

  async function signIn() {
    setBusy(true);
    setError("");
    setSuspended(false);
    try {
      const result = await api<{ role: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await go(result.role);
    } catch (err) {
      if (err instanceof ApiError && err.code === "suspended") setSuspended(true);
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function sendAppeal() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/appeal", { method: "POST", body: JSON.stringify({ email, password, message: appeal }) });
      setAppeal("");
      setSuspended(false);
      setError("Appeal sent. You will be able to sign in if it is approved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the appeal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:py-10 lg:grid-cols-[1fr_440px] lg:items-start lg:gap-10">
      <div className="order-2 lg:order-1">
        <div className="relative hidden overflow-hidden rounded-3xl bg-plum p-8 text-white lg:block">
          <span className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
          <span className="absolute -bottom-16 right-10 h-56 w-56 rounded-full bg-white/10" />
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
            <Icon name="cameraBold" size={26} />
          </span>
          <h1 className="mt-6 max-w-sm text-3xl font-semibold leading-tight tracking-tight">Browse freely. Sign in to save, order, and rate.</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/85">
            Save the posts you like, order from profiles, and rate after an accepted order. Your email and phone stay private.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/90">
            <li className="flex items-center gap-2"><Icon name="check" size={18} /> Adults 18 and over only</li>
            <li className="flex items-center gap-2"><Icon name="check" size={18} /> Hooks accept or decline every order</li>
            <li className="flex items-center gap-2"><Icon name="check" size={18} /> Ratings only after real orders</li>
          </ul>
        </div>
        <div className="card mt-0 p-4 lg:mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Local demo accounts</p>
            <span className="rounded-full bg-canvas px-2 py-0.5 font-mono text-[11px] text-muted">{DEMO_PASSWORD}</span>
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                  setError("");
                }}
                className="press flex items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-canvas"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose text-plum">
                  <Icon name={account.icon} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{account.label}</span>
                  <span className="block truncate text-xs text-muted">{account.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card order-1 p-5 sm:p-6 lg:order-2">
        <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-1 text-sm text-muted">Sign in to continue, or create an account with Google.</p>
        {notice === "creator" ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose px-3.5 py-3 text-[13px] leading-5 text-plum">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" /> The studio is for hooks. Join as a hook to get one.
          </p>
        ) : null}
        <div className="mt-5">
          <GoogleButton
            intent="user"
            onDone={(result: GoogleResult) => go(result.role, result.hasProfile)}
          />
        </div>
        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            signIn();
          }}
        >
          <div className="space-y-3.5">
            <Field label="Email"><input type="email" className={controlClass} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>
            <Field label="Password">
              <span className="relative block">
                <input type={show ? "text" : "password"} className={`${controlClass} pr-11`} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                <button type="button" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((value) => !value)}>
                  <Icon name={show ? "eyeClosed" : "eye"} size={18} />
                </button>
              </span>
            </Field>
          </div>
          {error ? (
            <p className={cn("mt-4 flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13px] leading-5", error.startsWith("Appeal sent") ? "bg-rose text-plum" : "bg-[#fbf1ef] text-danger")}>
              <Icon name={error.startsWith("Appeal sent") ? "check" : "warning"} size={18} className="mt-0.5 shrink-0" /> {error}
            </p>
          ) : null}
          {suspended ? (
            <div className="mt-4 space-y-2">
              <Field label="Appeal"><textarea className={`${controlClass} h-auto py-3`} rows={4} value={appeal} onChange={(event) => setAppeal(event.target.value)} /></Field>
              <Button variant="outline" onClick={sendAppeal} disabled={busy}>Submit appeal</Button>
            </div>
          ) : null}
          <Button type="submit" variant="outline" className="mt-5 w-full" disabled={busy || !email || !password}>
            {busy ? "Please wait" : "Sign in with email"}
          </Button>
        </form>
        <p className="mt-4 text-center text-[13px] text-muted">
          New here? <Link href="/join" className="font-medium text-plum">Join Daylight</Link>
        </p>
      </div>
    </div>
  );
}
