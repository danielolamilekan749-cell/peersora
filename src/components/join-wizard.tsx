"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError, uploadImage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { GoogleButton } from "@/components/google-button";
import { Icon, type IconName } from "@/components/icon";
import { JoinChoice } from "@/components/join-choice";
import { usePlatform } from "@/components/platform";
import { Button, controlClass, Field } from "@/components/ui";

const hookSteps: { label: string; icon: IconName }[] = [
  { label: "Google", icon: "user" },
  { label: "Photo", icon: "camera" },
  { label: "Location", icon: "pin" },
];

export function JoinFlow() {
  const params = useSearchParams();
  const kind = params.get("as");
  const { viewer, loading } = usePlatform();

  if (loading && (kind === "hook" || kind === "user")) {
    return (
      <Shell>
        <div className="space-y-3" aria-busy>
          <div className="animate-pulse bg-line/80 h-12 w-12 rounded-2xl" />
          <div className="animate-pulse bg-line/80 h-7 w-2/3 rounded-lg" />
          <div className="animate-pulse bg-line/80 h-12 w-full rounded-full" />
        </div>
      </Shell>
    );
  }

  if (kind === "hook") return <HookFlow signedRole={viewer?.role ?? "guest"} profileId={viewer?.profileId ?? null} username={viewer?.username ?? null} />;
  if (kind === "user") return <UserFlow signedRole={viewer?.role ?? "guest"} />;

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">Join Daylight</h1>
      <p className="mt-1.5 text-sm leading-6 text-muted">Are you joining as a hook or a user?</p>
      <div className="mt-5">
        <JoinChoice />
      </div>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-plum">Sign in</Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-14">
      <div className="card p-5 sm:p-7">{children}</div>
    </div>
  );
}

function SignOutNote({ role, wants }: { role: string; wants: "user" | "hook" }) {
  const router = useRouter();
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">You are already signed in</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        This account is a {role === "creator" ? "hook" : "user"} account. To join as a {wants}, sign out first and continue with a different Google account.
      </p>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.refresh(); window.location.reload(); }}>
          Sign out
        </Button>
        <Link href="/" className="press inline-flex h-11 flex-1 items-center justify-center rounded-full bg-plum text-sm font-semibold text-white">Back to feed</Link>
      </div>
    </>
  );
}

function UserFlow({ signedRole }: { signedRole: string }) {
  const router = useRouter();
  const { refresh } = usePlatform();

  return (
    <Shell>
      {signedRole === "member" ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight">You are signed in</h1>
          <Link href="/" className="press mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-plum text-sm font-semibold text-white">Go to feed</Link>
        </>
      ) : signedRole !== "guest" ? (
        <SignOutNote role={signedRole} wants="user" />
      ) : (
        <>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose text-plum"><Icon name="user" size={24} /></span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Join as a user</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">Save posts, follow profiles, place orders, and rate. It takes one tap.</p>
          <div className="mt-6">
            <GoogleButton
              intent="user"
              onDone={async () => {
                await refresh();
                router.push("/");
                router.refresh();
              }}
            />
          </div>
          <p className="mt-5 text-center text-sm text-muted">
            Want to post instead? <Link href="/join?as=hook" className="font-semibold text-plum">Join as a hook</Link>
          </p>
        </>
      )}
    </Shell>
  );
}

function HookFlow({ signedRole, profileId, username }: { signedRole: string; profileId: string | null; username: string | null }) {
  const router = useRouter();
  const { refresh } = usePlatform();
  const [photoDone, setPhotoDone] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  const signedHook = signedRole === "creator";
  const finished = Boolean(created) || Boolean(profileId);
  const step = !signedHook ? 0 : finished ? 3 : photoDone ? 2 : 1;

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setAvatar(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (location.trim().length < 2) {
      setError("Enter your location.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ username: string }>("/api/auth/hook-profile", {
        method: "POST",
        body: JSON.stringify({ avatar, location, phone }),
      });
      setCreated(result.username);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  if (signedRole !== "guest" && !signedHook) {
    return (
      <Shell>
        <SignOutNote role={signedRole} wants="hook" />
      </Shell>
    );
  }

  if (step === 3) {
    const name = created ?? username;
    return (
      <Shell>
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose text-plum"><Icon name="check" size={36} /></span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Your hook profile is ready</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            It becomes discoverable once age and identity verification is approved. You can start posting right away.
          </p>
          <div className="mt-6 grid gap-2">
            <Link href="/dashboard/posts?new=1" className="press inline-flex h-11 items-center justify-center gap-2 rounded-full bg-plum text-sm font-semibold text-white"><Icon name="galleryAdd" size={18} /> Add your first post</Link>
            {name ? <Link href={`/profile/${name}`} className="press inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold ring-1 ring-line hover:bg-canvas">View my profile</Link> : null}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Step {step + 1} of 3</p>
        <p className="text-sm font-semibold">{hookSteps[step].label}</p>
      </div>
      <ol className="mt-2 grid grid-cols-3 gap-1.5" aria-label="Progress">
        {hookSteps.map((item, index) => (
          <li key={item.label} className={cn("h-1.5 rounded-full", index <= step ? "bg-plum" : "bg-line")} />
        ))}
      </ol>

      {step === 0 ? (
        <div className="mt-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose text-plum"><Icon name="camera" size={24} /></span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Join as a hook</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">Continue with Google, add a photo, then your location. Then you can post and take orders.</p>
          <div className="mt-6">
            <GoogleButton
              intent="hook"
              onDone={async () => {
                await refresh();
                router.refresh();
              }}
            />
          </div>
          <p className="mt-5 text-center text-sm text-muted">
            Just browsing? <Link href="/join?as=user" className="font-semibold text-plum">Join as a user</Link>
          </p>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight">Add your profile photo</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">A clear photo of you. This is what people see on search and your profile.</p>
          <div className="mt-5">
            <PhotoField label="Profile photo" shape="round" url={avatar} onFile={choosePhoto} />
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <Button className="mt-6 w-full" disabled={!avatar || busy} onClick={() => { setError(""); setPhotoDone(true); }}>
            {busy ? "Uploading" : "Continue"} {busy ? null : <Icon name="forward" size={16} />}
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <form className="mt-6" onSubmit={(event) => { event.preventDefault(); finish(); }}>
          <h1 className="text-2xl font-semibold tracking-tight">Where are you based?</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">Type your location in your own words. Exact addresses are never shown.</p>
          <div className="mt-5 space-y-3.5">
            <Field label="Your location">
              <input className={controlClass} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Lekki, Lagos, Nigeria" autoComplete="off" autoFocus />
            </Field>
            <Field label="Phone number" hint="Private. Only used by Daylight to reach you. It is never shown on your profile.">
              <input type="tel" inputMode="tel" className={controlClass} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+234 801 234 5678" autoComplete="tel" />
            </Field>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setPhotoDone(false)}><Icon name="back" size={16} /> Back</Button>
            <Button type="submit" className="flex-1" disabled={busy}>{busy ? "Saving" : "Finish"}</Button>
          </div>
        </form>
      ) : null}
    </Shell>
  );
}

export function PhotoField({ label, url, error, hint, onFile, shape = "square" }: { label: string; url: string; error?: string; hint?: string; onFile: (file?: File) => void; shape?: "square" | "round" | "wide" }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <span className="flex items-center gap-4">
        <span className={cn("relative shrink-0 overflow-hidden bg-canvas ring-1 ring-line", shape === "round" ? "h-20 w-20 rounded-full" : shape === "wide" ? "h-20 w-36 rounded-2xl" : "h-20 w-20 rounded-2xl")}>
          {url ? <Image src={url} alt="" fill sizes="144px" className="object-cover" /> : <span className="grid h-full w-full place-items-center text-muted"><Icon name="camera" size={22} /></span>}
        </span>
        <span className="press inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-ink ring-1 ring-line hover:bg-canvas">
          <Icon name="upload" size={16} /> {url ? "Replace photo" : "Upload photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFile(event.target.files?.[0])} className="sr-only" />
        </span>
      </span>
    </Field>
  );
}
