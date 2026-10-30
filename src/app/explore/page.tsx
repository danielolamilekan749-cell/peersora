import { Suspense } from "react";
import { DiscoveryScreen } from "@/components/discovery";

export const metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading search…</p>}>
      <DiscoveryScreen mode="explore" />
    </Suspense>
  );
}
