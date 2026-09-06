import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LEGACY_FALLBACK_ZONE, resolveUserZone } from "./timezone";

/**
 * The IANA zone every per-user calendar computation should use. Reads the
 * stored preference (adopted from the client on session start) and falls back
 * to the legacy zone on any error so a stats request never 500s over a
 * timezone lookup.
 */
export async function userZone(userId: string): Promise<string> {
  try {
    const [user] = await db.select({ timezone: usersTable.timezone })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    return resolveUserZone(user?.timezone);
  } catch {
    return LEGACY_FALLBACK_ZONE;
  }
}
