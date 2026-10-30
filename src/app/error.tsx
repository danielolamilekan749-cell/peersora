"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted">The page could not be loaded. You can try again without losing your place.</p>
      <button type="button" onClick={reset} className="mt-6 h-11 rounded-full bg-plum px-5 text-sm text-white">
        Try again
      </button>
    </div>
  );
}
