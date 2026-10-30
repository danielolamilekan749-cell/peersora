import { Suspense } from "react";
import { PostsManager } from "@/components/creator-screens";

export const metadata = { title: "My posts" };

export default function DashboardPostsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading posts…</p>}>
      <PostsManager />
    </Suspense>
  );
}
