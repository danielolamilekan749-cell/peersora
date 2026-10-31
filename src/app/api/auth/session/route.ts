import { handle } from "@/lib/server/http";
import { buildViewer } from "@/lib/server/social";

export async function GET() {
  return handle((db, ctx) => ({ viewer: buildViewer(db, ctx) }));
}
