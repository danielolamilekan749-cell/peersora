"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import type { PublicPost, PublicProfile, ViewerState } from "@/lib/types";
import { Dialog } from "@/components/ui";
import { JoinChoice } from "@/components/join-choice";
import { OrderDialog } from "@/components/order-dialog";

type Toast = { id: number; text: string };

type PlatformValue = {
  profiles: PublicProfile[];
  posts: PublicPost[];
  viewer: ViewerState | null;
  loading: boolean;
  place: string;
  setPlace: (value: string) => void;
  unread: number;
  toast: (text: string) => void;
  askAuth: (message: string) => void;
  askJoin: () => void;
  orderNow: (profile: PublicProfile) => void;
  refresh: () => Promise<void>;
  saveProfile: (id: string) => Promise<void>;
  savePost: (id: string) => Promise<void>;
  like: (id: string) => Promise<void>;
  block: (id: string) => Promise<void>;
  report: (input: { targetType: string; targetId: string; reason: string; details: string }) => Promise<boolean>;
};

const PlatformContext = createContext<PlatformValue | null>(null);
export function usePlatform() {
  const value = useContext(PlatformContext);
  if (!value) throw new Error("Platform provider is missing.");
  return value;
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [place, setPlaceState] = useState("Anywhere");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [orderTarget, setOrderTarget] = useState<PublicProfile | null>(null);
  const [unread, setUnread] = useState(0);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    const data = await api<{ profiles: PublicProfile[]; posts: PublicPost[]; viewer: ViewerState }>("/api/directory");
    setProfiles(data.profiles);
    setPosts(data.posts);
    setViewer(data.viewer);
    if (data.viewer.role !== "guest") {
      const notes = await api<{ unread: number }>("/api/notifications");
      setUnread(notes.unread);
    } else {
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("dl_place");
    if (saved) setPlaceState(saved);
    refresh()
      .catch(() => toast("The feed could not refresh. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [refresh, toast]);

  const setPlace = useCallback((value: string) => {
    setPlaceState(value);
    window.localStorage.setItem("dl_place", value);
  }, []);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      if (!viewer) {
        toast("Just a moment.");
        return false;
      }
      if (viewer.role === "guest") {
        setAuthMessage("Join Daylight to like, save, comment, or report.");
        setJoinOpen(true);
        return false;
      }
      try {
        const data = await api<{ viewer: ViewerState }>("/api/social", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setViewer(data.viewer);
        const directory = await api<{ profiles: PublicProfile[]; posts: PublicPost[] }>("/api/directory");
        setProfiles(directory.profiles);
        setPosts(directory.posts);
        return true;
      } catch (error) {
        if (error instanceof ApiError && (error.code === "auth_required" || error.code === "account_required")) {
          setAuthMessage(error.message);
          setJoinOpen(true);
          return false;
        }
        toast(error instanceof Error ? error.message : "Something went wrong.");
        return false;
      }
    },
    [toast, viewer],
  );

  const value = useMemo<PlatformValue>(
    () => ({
      profiles,
      posts,
      viewer,
      loading,
      place,
      setPlace,
      unread,
      toast,
      askAuth: (message) => {
        setAuthMessage(message);
        setJoinOpen(true);
      },
      askJoin: () => {
        setAuthMessage(null);
        setJoinOpen(true);
      },
      orderNow: (profile) => {
        if (!viewer || viewer.role === "guest") {
          setAuthMessage("Join as a user to place an order.");
          setJoinOpen(true);
        } else if (viewer.role !== "member") {
          toast("Orders are placed from a user account.");
        } else {
          setOrderTarget(profile);
        }
      },
      refresh,
      saveProfile: async (id) => {
        const on = !viewer?.savedProfiles.includes(id);
        const ok = await act({ action: on ? "save-profile" : "unsave-profile", id });
        if (ok) toast(on ? "Saved profile" : "Removed from saved");
      },
      savePost: async (id) => {
        const on = !viewer?.savedPosts.includes(id);
        const ok = await act({ action: on ? "save-post" : "unsave-post", id });
        if (ok) toast(on ? "Post saved" : "Post removed");
      },
      like: async (id) => {
        const on = !viewer?.likes.includes(id);
        await act({ action: on ? "like" : "unlike", id });
      },
      block: async (id) => {
        const ok = await act({ action: "block", id });
        if (ok) toast("Profile blocked");
      },
      report: async (input) => {
        const ok = await act({ action: "report", ...input });
        if (ok) toast("Report sent to moderation");
        return ok;
      },
    }),
    [act, loading, place, posts, profiles, refresh, setPlace, toast, unread, viewer],
  );

  return (
    <PlatformContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((item) => (
          <div key={item.id} className="fade-up pointer-events-auto rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-white shadow-float">
            {item.text}
          </div>
        ))}
      </div>
      <Dialog open={joinOpen} title="Join Daylight" onClose={() => setJoinOpen(false)}>
        <p className="mb-4 text-sm leading-6 text-muted">{authMessage ?? "Are you joining as a user or as a hook?"}</p>
        <JoinChoice onPick={() => setJoinOpen(false)} />
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-plum" onClick={() => setJoinOpen(false)}>
            Sign in
          </Link>
        </p>
      </Dialog>
      <OrderDialog
        profile={orderTarget}
        onClose={() => setOrderTarget(null)}
        onPlaced={() => toast("Order sent. You will be notified when the hook responds.")}
        onAuth={(message) => {
          setAuthMessage(message);
          setJoinOpen(true);
        }}
      />
    </PlatformContext.Provider>
  );
}
