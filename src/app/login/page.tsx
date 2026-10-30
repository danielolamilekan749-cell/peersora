import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted">Loading sign in…</p>}>
      <LoginForm />
    </Suspense>
  );
}
