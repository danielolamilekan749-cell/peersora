import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-4">
      <div role="status" className="flex items-center gap-3 text-sm font-medium text-muted">
        <Spinner size={20} className="text-plum" />
        <span>Loading Daylight...</span>
      </div>
    </main>
  );
}
