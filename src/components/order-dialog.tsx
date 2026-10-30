"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PublicProfile } from "@/lib/types";
import { Icon } from "@/components/icon";
import { Avatar, Button, controlClass, Dialog, Field } from "@/components/ui";

export function OrderDialog({
  profile,
  onClose,
  onPlaced,
  onAuth,
}: {
  profile: PublicProfile | null;
  onClose: () => void;
  onPlaced: () => void;
  onAuth: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function place() {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/orders", { method: "POST", body: JSON.stringify({ action: "place", profileId: profile.id, note }) });
      setNote("");
      onClose();
      onPlaced();
    } catch (err) {
      if (err instanceof ApiError && err.code === "auth_required") {
        onClose();
        onAuth("Join as a user to place an order.");
      } else {
        setError(err instanceof Error ? err.message : "Could not place the order.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(profile)} title="Order now" onClose={onClose}>
      {profile ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
            <Avatar src={profile.avatar} size={48} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.displayName}</p>
              <p className="truncate text-[13px] text-muted">{profile.cityLabel}</p>
            </div>
          </div>
          {!profile.orderable ? (
            <div className="space-y-3 text-sm leading-6 text-muted">
              <p>This sample profile is a preview and cannot take orders.</p>
              <Link href="/profile/amara" onClick={onClose} className="inline-flex items-center gap-1 font-medium text-plum">
                Try Amara, the demo hook <Icon name="forward" size={14} />
              </Link>
            </div>
          ) : (
            <>
              <Field label="Note" hint="Optional. She accepts or declines your order and you are notified either way.">
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={500} className={`${controlClass} h-auto py-3`} placeholder="Tell her what you have in mind." />
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button onClick={place} disabled={busy} className="w-full">
                <Icon name="bag" size={18} /> {busy ? "Placing order" : "Place order"}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
