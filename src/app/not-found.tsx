import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">That page is not here</h1>
      <p className="mt-3 text-sm text-muted">The profile or post may be private, or the link may be out of date.</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-plum px-5 text-sm text-white">
        Back to discovery
      </Link>
    </div>
  );
}
