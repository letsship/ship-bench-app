import type { Db } from "./types";

// Test-only injection seam. Integration tests point getDb() at an isolated
// in-memory database via __setTestDb(); production code never calls it.
let testDb: Db | null = null;

export function __setTestDb(db: Db | null): void {
  testDb = db;
}

function isCloudflareWorkers(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

// Resolve the request's database. On Cloudflare Workers this is the D1 binding;
// everywhere else (dev, `next start`, tests) it is a local better-sqlite3 file.
// Environment selection, not a fallback: each runtime has exactly one driver.
export async function getDb(): Promise<Db> {
  if (testDb) return testDb;
  if (isCloudflareWorkers()) {
    const { getD1Db } = await import("./cf");
    return getD1Db();
  }
  const { getNodeDb } = await import("./node");
  return getNodeDb();
}

export * from "./schema";
export { newId } from "./ids";
export type { IdPrefix } from "./ids";
export type { Db } from "./types";
