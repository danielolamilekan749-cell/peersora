import { Suspense } from "react";
import { JoinFlow } from "@/components/join-wizard";

export const metadata = { title: "Join" };

export default function JoinPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted">Loading…</p>}>
      <JoinFlow />
    </Suspense>
  );
}
