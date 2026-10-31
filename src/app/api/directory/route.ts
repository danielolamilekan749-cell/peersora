import { handle } from "@/lib/server/http";
import { directory } from "@/lib/server/social";

export async function GET() {
  return handle((db, ctx) => directory(db, ctx));
}
