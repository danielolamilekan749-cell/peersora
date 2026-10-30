"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { OrderStatus, PublicOrder } from "@/lib/types";
import { Icon } from "@/components/icon";
import { usePlatform } from "@/components/platform";
import { Avatar, Button, EmptyState, PageTitle, Skeleton, Tag } from "@/components/ui";

const statusLabel: Record<OrderStatus, string> = {
  pending: "Waiting",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function OrdersScreen() {
  const { viewer, askJoin, toast, loading: platformLoading } = usePlatform();
  const [role, setRole] = useState("member");
  const [items, setItems] = useState<PublicOrder[] | null>(null);
  const signedIn = Boolean(viewer && viewer.role !== "guest");

  const load = useCallback(async () => {
    const data = await api<{ role: string; items: PublicOrder[] }>("/api/orders");
    setRole(data.role);
    setItems(data.items);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    load().catch(() => setItems([]));
  }, [load, signedIn]);

  async function act(id: string, action: string, message: string) {
    try {
      await api("/api/orders", { method: "POST", body: JSON.stringify({ action, id }) });
      toast(message);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update the order.");
    }
  }

  if (!signedIn && !platformLoading) {
    return (
      <div className="pt-3 lg:max-w-xl lg:pt-0">
        <EmptyState icon="clipboard" title="Join to place orders" body="Orders you place, and their status, show up here." action={<Button onClick={askJoin}>Join Daylight</Button>} />
      </div>
    );
  }

  const hook = role === "creator";

  return (
    <div className="mx-auto max-w-2xl pt-3 lg:mx-0 lg:pt-0">
      <PageTitle title="Orders" subtitle={hook ? "Orders placed with you. Accept or decline each one." : "Orders you have placed."} />
      <div className="mt-5 space-y-3">
        {items === null ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : items.length === 0 ? (
          <EmptyState icon="clipboard" title="No orders yet" body={hook ? "When a user places an order it will appear here." : "Tap Order now on a profile to place your first order."} action={hook ? undefined : <Link href="/explore" className="press inline-flex h-11 items-center rounded-full bg-plum px-5 text-sm font-semibold text-white">Find a profile</Link>} />
        ) : (
          items.map((order) => (
            <article key={order.id} className="card p-4">
              <div className="flex items-center gap-3">
                <Avatar src={hook ? undefined : order.profile.avatar} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{hook ? order.customerName : order.profile.displayName}</p>
                  <p className="text-xs text-muted">{formatWhen(order.createdAt)}</p>
                </div>
                <Tag tone={order.status === "pending" ? "muted" : order.status === "declined" || order.status === "cancelled" ? "muted" : "success"}>{statusLabel[order.status]}</Tag>
              </div>
              {order.note ? <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-sm leading-6">{order.note}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {hook && order.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => act(order.id, "accept", "Order accepted")}><Icon name="check" size={15} /> Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => act(order.id, "decline", "Order declined")}>Decline</Button>
                  </>
                ) : null}
                {hook && order.status === "accepted" ? <Button size="sm" onClick={() => act(order.id, "complete", "Order completed")}><Icon name="bagCheck" size={16} /> Mark completed</Button> : null}
                {!hook && (order.status === "pending" || order.status === "accepted") ? <Button size="sm" variant="outline" onClick={() => act(order.id, "cancel", "Order cancelled")}>Cancel order</Button> : null}
                {!hook && order.canRate ? (
                  <Link href={`/profile/${order.profile.username}?tab=ratings`} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-rose px-4 text-[13px] font-semibold text-plum"><Icon name="starBold" size={15} /> Rate</Link>
                ) : null}
                {!hook && order.rated ? <Tag tone="soft">Rated</Tag> : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
