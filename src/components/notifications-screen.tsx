"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatWhen } from "@/lib/format";
import { Icon, type IconName } from "@/components/icon";
import { usePlatform } from "@/components/platform";
import { Button, EmptyState, PageTitle, Skeleton } from "@/components/ui";

type Note = { id: string; title: string; body: string; href: string | null; read: boolean; createdAt: string; type: string };

function iconFor(type: string): IconName {
  if (type.includes("order")) return "bag";
  if (type.includes("follow")) return "userPlus";
  if (type.includes("like")) return "heartBold";
  if (type.includes("comment")) return "comment";
  if (type.includes("review")) return "starBold";
  if (type.includes("verif") || type.includes("moderation")) return "shieldBold";
  return "bell";
}

export function NotificationsScreen() {
  const { viewer, askAuth, refresh } = usePlatform();
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ items: Note[] }>("/api/notifications")
      .then((data) => setItems(data.items))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 pt-3 lg:pt-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }
  if (!viewer || viewer.role === "guest") {
    return (
      <div className="pt-3 lg:pt-0">
        <EmptyState icon="bell" title="Sign in for alerts" body="Orders, likes, comments, and verification updates appear here." action={<Button onClick={() => askAuth("Join or sign in to see your notifications.")}>Join or sign in</Button>} />
      </div>
    );
  }

  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <div className="mx-auto max-w-2xl pt-3 lg:mx-0 lg:pt-0">
      <PageTitle
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "You are caught up"}
        action={
          items.length > 0 ? (
            <Button variant="outline" size="sm" onClick={async () => {
              const data = await api<{ items: Note[] }>("/api/notifications", { method: "POST" });
              setItems(data.items);
              refresh().catch(() => undefined);
            }}>
              <Icon name="checkLine" size={16} /> Mark all read
            </Button>
          ) : null
        }
      />
      <div className="mt-4">
        {items.length === 0 ? <EmptyState icon="bell" title="You are caught up" body="New orders, likes, comments, and verification updates will show up here." /> : null}
        {items.length > 0 ? (
          <div className="card divide-y divide-line overflow-hidden">
            {items.map((item) => {
              const content = (
                <>
                  <span className={cn("relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full", item.read ? "bg-canvas text-muted" : "bg-rose text-plum")}>
                    <Icon name={iconFor(item.type)} size={19} />
                    {!item.read ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-plum ring-2 ring-white" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-5", item.read ? "font-medium" : "font-semibold")}>{item.title}</span>
                    <span className="block text-[13px] leading-5 text-muted">{item.body}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted">
                    {formatWhen(item.createdAt)}
                    {item.href ? <Icon name="forward" size={14} /> : null}
                  </span>
                </>
              );
              return item.href ? (
                <Link key={item.id} href={item.href} className={cn("flex items-start gap-3 px-4 py-3 transition hover:bg-canvas", !item.read && "bg-rose/30")}>
                  {content}
                </Link>
              ) : (
                <article key={item.id} className={cn("flex items-start gap-3 px-4 py-3", !item.read && "bg-rose/30")}>
                  {content}
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
