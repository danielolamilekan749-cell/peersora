import { change } from "@/lib/server/http";
import { openProfile } from "@/lib/server/social";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  return change((db, ctx) => openProfile(db, ctx, username));
}
