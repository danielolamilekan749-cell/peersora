"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleButton, type GoogleResult } from "@/components/google-button";
import { Icon } from "@/components/icon";
import { usePlatform } from "@/components/platform";

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = usePlatform();
  const notice = params.get("notice");

  async function go(result: GoogleResult) {
    await refresh();
    const next = params.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) router.push(next);
    else if (result.role === "admin") router.push("/admin");
    else if (result.role === "creator" && !result.hasProfile) router.push("/join?as=hook");
    else router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:py-10 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-10">
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
      <div className="card p-5 sm:p-6">
        <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-1 text-sm text-muted">Continue with your Google account. New here? It creates your account too.</p>
        {notice === "creator" ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose px-3.5 py-3 text-[13px] leading-5 text-plum">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" /> The studio is for hooks. Join as a hook to get one.
          </p>
        ) : null}
        <div className="mt-5">
          <GoogleButton intent="user" onDone={go} />
        </div>
        <p className="mt-5 text-center text-[13px] text-muted">
          Want to post? <Link href="/join?as=hook" className="font-medium text-plum">Join as a hook</Link>
        </p>
      </div>
    </div>
  );
}
