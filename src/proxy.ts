import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSession } from "@/lib/server/auth";

export function proxy(request: NextRequest) {
  const session = readSession(request.cookies.get("dl_session")?.value);
  const { pathname } = request.nextUrl;
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", pathname);

  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/dashboard")) {
    if (!session) return NextResponse.redirect(login);
    if (session.role === "member") {
      login.searchParams.set("notice", "creator");
      return NextResponse.redirect(login);
    }
  }

  if ((pathname.startsWith("/settings") || pathname.startsWith("/me") || pathname.startsWith("/orders")) && !session) {
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/settings",
    "/settings/:path*",
    "/me",
    "/orders",
  ],
};
