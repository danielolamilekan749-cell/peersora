import { Suspense } from "react";
import { DiscoveryScreen } from "@/components/discovery";

export default function HomePage() {
  return (
    <Suspense fallback={<FeedFallback />}>
      <DiscoveryScreen mode="home" />
    </Suspense>
  );
}

function FeedFallback() {
  return (
    <div className="mx-auto w-full max-w-[470px] space-y-4 pt-3 lg:pt-0">
      <div className="h-24 animate-pulse rounded-2xl bg-line/80" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-line/80" />
      ))}
    </div>
  );
}
