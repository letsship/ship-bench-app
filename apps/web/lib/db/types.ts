import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./schema";

// The app is typed against the Cloudflare D1 driver (the production target).
// The local better-sqlite3 driver used for dev / `next start` / tests exposes
// the identical drizzle query API, so lib/db/node.ts casts its instance to
// this type. The cast is safe: only the underlying transport differs.
export type Db = DrizzleD1Database<typeof schema>;
