import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/types";
import { type StudioContext, getStudioContext } from "./studio";

// Resolve the request database and the (single) studio context in one call.
// Shared by route handlers and server-component pages.
export async function resolveStudio(): Promise<{ db: Db; ctx: StudioContext }> {
  const db = await getDb();
  const ctx = await getStudioContext(db);
  return { db, ctx };
}
