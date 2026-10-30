import { NextResponse } from "next/server";
import { cookieOptions, roleCookieOptions } from "@/lib/server/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("dl_session", "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set("dl_role", "", { ...roleCookieOptions, maxAge: 0 });
  return response;
}
