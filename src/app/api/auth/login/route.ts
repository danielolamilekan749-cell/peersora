import { NextResponse } from "next/server";

// Email and password sign-in is switched off. Everyone continues with Google.
export async function POST() {
  return NextResponse.json({ error: "Continue with Google to sign in.", code: "auth" }, { status: 410 });
}
