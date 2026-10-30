import { Suspense } from "react";
import { GoogleCallback } from "@/components/google-callback";

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallback />
    </Suspense>
  );
}
