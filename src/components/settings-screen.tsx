"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { NotificationPrefs } from "@/lib/types";
import { Icon, type IconName } from "@/components/icon";
import { usePlatform } from "@/components/platform";
import { Button, controlClass, Dialog, Field, PageTitle, Skeleton, Switch } from "@/components/ui";

function Section({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose text-plum">
          <Icon name={icon} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {body ? <p className="mt-0.5 text-[13px] text-muted">{body}</p> : null}
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

const prefLabels: Record<string, string> = {
  orders: "Orders",
  likes: "Likes on posts",
  comments: "Comments",
  verification: "Verification updates",
  reviews: "New reviews",
};

type SettingsData = {
  account: {
    email: string;
    fullName: string;
    phone: string;
    role: string;
    deactivated: boolean;
    notificationPrefs: NotificationPrefs;
  };
  profile: {
    visibility: "public" | "hidden";
    discoverable: boolean;
    locationPrivacy: "city" | "region" | "hidden";
  } | null;
  blocked: { id: string; name: string; username: string | null }[];
};

export function SettingsScreen() {
  const router = useRouter();
  const { toast, refresh } = usePlatform();
  const [data, setData] = useState<SettingsData | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [privacy, setPrivacy] = useState<"city" | "region" | "hidden">("city");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    const next = await api<SettingsData>("/api/me?view=settings");
    setData(next);
    setFullName(next.account.fullName);
    setPhone(next.account.phone);
    setPrefs(next.account.notificationPrefs);
    if (next.profile) {
      setPrivacy(next.profile.locationPrivacy);
    }
  }

  useEffect(() => {
    load().catch((error: unknown) => toast(error instanceof Error ? error.message : "Settings unavailable"));
  }, [toast]);

  async function patch(body: Record<string, unknown>, message: string, key = "generic") {
    setBusyKey(key);
    try {
      await api("/api/me", { method: "PATCH", body: JSON.stringify(body) });
      toast(message);
      try {
        await Promise.all([load(), refresh()]);
      } catch (error) {
        toast(error instanceof Error ? `Saved, but could not refresh settings: ${error.message}` : "Saved, but could not refresh settings.");
      }
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save your settings.");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  if (!data || !prefs) {
    return (
      <div className="space-y-4 pt-3 lg:pt-0">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3 lg:pt-0">
      <PageTitle title="Settings" subtitle={data.account.email} />
      <Section icon="user" title="Account" body="Your name is shown on orders and ratings. Your email and phone stay private.">
        <Field label="Name"><input className={controlClass} value={fullName} onChange={(event) => setFullName(event.target.value)} /></Field>
        <Field label="Phone" hint="Private. Used only for your account, never on your public profile."><input className={controlClass} value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Button loading={busyKey === "account"} onClick={() => patch({ fullName, phone }, "Account saved", "account")}>Save account</Button>
      </Section>
      {data.profile ? (
        <Section icon="shield" title="Privacy" body="Control what visitors can see on your profile.">
          <Field label="Location shown publicly">
            <select className={controlClass} value={privacy} onChange={(event) => setPrivacy(event.target.value as typeof privacy)}>
              <option value="city">City</option>
              <option value="region">Region</option>
              <option value="hidden">Hidden</option>
            </select>
          </Field>
          <Button loading={busyKey === "privacy"} onClick={() => patch({ locationPrivacy: privacy }, "Privacy saved", "privacy")}>Save privacy</Button>
        </Section>
      ) : null}
      <Section icon="bell" title="Notifications" body="Choose what shows up in your alerts.">
        <div className="divide-y divide-line rounded-2xl bg-canvas px-4">
          {(Object.keys(prefs) as (keyof NotificationPrefs)[]).map((key) => (
            <label key={key} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="font-medium capitalize">{prefLabels[key] ?? key}</span>
              <Switch checked={prefs[key]} onChange={(event) => setPrefs({ ...prefs, [key]: event.target.checked })} />
            </label>
          ))}
        </div>
        <Button loading={busyKey === "notifications"} onClick={() => patch({ notificationPrefs: prefs }, "Notification preferences saved", "notifications")}>Save notifications</Button>
      </Section>
      <Section icon="block" title="Blocked profiles" body="Blocked profiles cannot see you or message you.">
        {data.blocked.length === 0 ? <p className="rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">You have not blocked anyone.</p> : null}
        {data.blocked.map((block) => (
          <div key={block.id} className="flex items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-2.5 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-plum">{block.name.slice(0, 1)}</span>
              <span className="truncate">{block.name}{block.username ? <span className="text-muted"> @{block.username}</span> : null}</span>
            </span>
            <Button size="sm" variant="outline" loading={busyKey === `unblock:${block.id}`} onClick={async () => {
              const key = `unblock:${block.id}`;
              setBusyKey(key);
              try {
                await api("/api/social", { method: "POST", body: JSON.stringify({ action: "unblock", id: block.id }) });
                await load();
                toast("Profile unblocked");
              } catch (error) {
                toast(error instanceof Error ? error.message : "Could not unblock this profile.");
              } finally {
                setBusyKey(null);
              }
            }}>Unblock</Button>
          </div>
        ))}
      </Section>
      <Section icon="warning" title="Account status" body="Deactivating hides your profile but keeps your account. Deleting is permanent.">
        <div className="flex flex-wrap gap-2">
          {data.account.role === "creator" ? (
            data.account.deactivated ? (
              <Button variant="outline" loading={busyKey === "reactivate"} onClick={() => patch({ reactivate: true }, "Account reactivated. Turn discovery back on when you are ready.", "reactivate")}>Reactivate</Button>
            ) : (
              <Button variant="outline" loading={busyKey === "deactivate"} onClick={() => patch({ deactivate: true }, "Profile hidden. You can still sign in.", "deactivate")}><Icon name="eyeClosed" size={16} /> Deactivate profile</Button>
            )
          ) : null}
          <Button variant="danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Delete account</Button>
        </div>
      </Section>
      <Dialog open={confirmDelete} title="Delete your account?" onClose={() => setConfirmDelete(false)}>
        <p className="text-sm leading-6 text-muted">Your public profile will be removed and the account cannot be signed into again.</p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" variant="danger" loading={busyKey === "delete"} onClick={async () => {
            const deleted = await patch({ deleteAccount: true }, "Account deleted", "delete");
            if (!deleted) return;
            try {
              await api("/api/auth/logout", { method: "POST" });
            } catch (error) {
              toast(error instanceof Error ? error.message : "Account deleted, but sign out failed.");
            }
            router.push("/");
            router.refresh();
          }}>Delete account</Button>
          <Button className="flex-1" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  );
}
