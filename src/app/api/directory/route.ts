import { readDb } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { directory } from "@/lib/server/social";

export async function GET() {
  return handle((ctx) => directory(readDb(), ctx));
}
