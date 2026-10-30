"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatWhen } from "@/lib/format";
import { Icon, type IconName } from "@/components/icon";
import { Button, EmptyState, Skeleton, Tag } from "@/components/ui";

const tabIcons: Record<string, IconName> = {
  Overview: "dashboard",
  Verification: "shieldUser",
  Reports: "flag",
  Reviews: "star",
  People: "users",
  Appeals: "inbox",
  Audit: "document",
};

type AdminData = {
  metrics: Record<string, number>;
  verifications: { id: string; displayName: string; username: string; email: string; city: string; country: string; age: number | null; bio: string; sample: boolean; createdAt: string }[];
  reports: { id: string; targetType: string; reason: string; details: string; status: string; snippet: string; createdAt: string }[];
  reviews: { id: string; authorName: string; profileName: string; rating: number; body: string; status: string }[];
  appeals: { id: string; email: string; message: string; status: string }[];
  audits: { id: string; action: string; targetType: string; meta: string; createdAt: string }[];
  users: { id: string; email: string; role: string; fullName: string; status: string; username: string | null; discoverable: boolean }[];
};

const tabs = ["Overview", "Verification", "Reports", "Reviews", "People", "Appeals", "Audit"] as const;

export function AdminScreen() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");

  async function load() {
    setData(await api<AdminData>("/api/admin"));
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Admin access failed"));
  }, []);

  async function act(body: Record<string, unknown>) {
    setData(await api<AdminData>("/api/admin", { method: "POST", body: JSON.stringify(body) }));
  }

  if (error) return <div className="p-6"><EmptyState icon="lock" title="Admin unavailable" body={error} /></div>;
  if (!data) {
    return (
      <div className="min-h-screen bg-canvas p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }

  const pending = data.verifications.length + data.reports.filter((report) => report.status === "open").length + data.appeals.filter((appeal) => appeal.status === "open").length;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-plum text-white"><Icon name="shieldBold" size={17} /></span>
          <span className="text-[1.1rem] font-semibold tracking-tight">Daylight admin</span>
        </Link>
        <div className="flex items-center gap-3">
          {pending > 0 ? <Tag tone="soft" className="px-2.5 py-1 text-xs">{pending} pending</Tag> : null}
          <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>
            <Icon name="logout" size={18} /> Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {tabs.map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={cn("press inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium", tab === item ? "bg-white text-plum shadow-card ring-1 ring-line" : "text-muted hover:bg-white/60 hover:text-ink")}>
              <Icon name={tabIcons[item]} size={18} />
              {item}
            </button>
          ))}
        </nav>
        <div>
          {tab === "Overview" ? (
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(data.metrics).map(([key, value]) => (
                <div key={key} className="card p-4">
                  <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
                  <dt className="mt-0.5 text-xs capitalize text-muted">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`)}</dt>
                </div>
              ))}
            </dl>
          ) : null}
          {tab === "Verification" ? (
            <div className="space-y-3">
              {data.verifications.length === 0 ? <EmptyState title="No pending requests" body="New hook profiles appear here until you approve or reject them." /> : null}
              {data.verifications.map((item) => (
                <article key={item.id} className="card p-4">
                  <h2 className="font-medium">{item.displayName} @{item.username}</h2>
                  <p className="text-sm text-muted">{item.email} · {[item.city, item.country].filter(Boolean).join(", ")} · Age {item.age ?? "unknown"}{item.sample ? " · Sample" : ""}</p>
                  <p className="mt-2 text-sm leading-6">{item.bio}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => act({ action: "approve", id: item.id })}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => act({ action: "reject", id: item.id, note: "Please update your profile and resubmit." })}>Reject</Button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {tab === "Reports" ? (
            <div className="space-y-2">
              {data.reports.map((report) => (
                <article key={report.id} className="card p-4">
                  <p className="text-sm font-medium capitalize">{report.targetType} · {report.reason} · {report.status}</p>
                  <p className="text-sm text-muted">{report.snippet}</p>
                  <p className="text-sm">{report.details}</p>
                  <p className="text-xs text-muted">{formatWhen(report.createdAt)}</p>
                  {report.status === "open" ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => act({ action: "resolve", id: report.id, hide: true })}>Resolve and hide</Button>
                      <Button size="sm" variant="outline" onClick={() => act({ action: "dismiss", id: report.id })}>Dismiss</Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
          {tab === "Reviews" ? (
            <div className="space-y-2">
              {data.reviews.length === 0 ? <EmptyState title="No reviews yet" body="Member reviews appear after an accepted connection. Nothing here is fabricated." /> : null}
              {data.reviews.map((review) => (
                <article key={review.id} className="card p-4 text-sm">
                  <p className="font-medium">{review.authorName} on {review.profileName} · {review.rating}/5 · {review.status}</p>
                  <p className="mt-1">{review.body}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => act({ action: "hide-review", id: review.id })}>Hide</Button>
                    <Button size="sm" variant="danger" onClick={() => act({ action: "remove-review", id: review.id })}>Remove</Button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {tab === "People" ? (
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className="border-t border-line">
                      <td className="p-3">{user.fullName}{user.username ? ` @${user.username}` : ""}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.status}{user.discoverable ? " · live" : ""}</td>
                      <td className="p-3 text-right">
                        {user.role !== "admin" && user.status === "active" ? <Button size="sm" variant="danger" onClick={() => act({ action: "suspend", id: user.id })}>Suspend</Button> : null}
                        {user.status === "suspended" ? <Button size="sm" onClick={() => act({ action: "restore", id: user.id })}>Restore</Button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {tab === "Appeals" ? (
            <div className="space-y-2">
              {data.appeals.length === 0 ? <EmptyState title="No appeals" body="Suspended members can submit an appeal from the sign-in page." /> : null}
              {data.appeals.map((appeal) => (
                <article key={appeal.id} className="card p-4 text-sm">
                  <p className="font-medium">{appeal.email} · {appeal.status}</p>
                  <p className="mt-1">{appeal.message}</p>
                  {appeal.status === "open" ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => act({ action: "restore", id: data.users.find((user) => user.email === appeal.email)?.id })}>Restore account</Button>
                      <Button size="sm" variant="outline" onClick={() => act({ action: "deny-appeal", id: appeal.id })}>Deny</Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
          {tab === "Audit" ? (
            <div className="space-y-2">
              {data.audits.map((entry) => (
                <p key={entry.id} className="card px-4 py-3 text-sm">
                  <span className="font-medium">{entry.action}</span> · {entry.targetType} · {entry.meta} · {formatWhen(entry.createdAt)}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
