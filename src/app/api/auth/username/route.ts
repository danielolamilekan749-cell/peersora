import { handle } from "@/lib/server/http";
import { usernameStatus } from "@/lib/server/social";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("u") ?? "";
  return handle((db) => usernameStatus(db, username));
}
