import { readDb } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { buildViewer } from "@/lib/server/social";

export async function GET() {
  return handle((ctx) => ({ viewer: buildViewer(readDb(), ctx) }));
}
