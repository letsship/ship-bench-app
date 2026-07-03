import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { Db } from "./types";

// The D1 database type drizzle expects, without pulling in a workers-types dep.
type D1 = Parameters<typeof drizzle>[0];

// Cloudflare Worker path: resolve the D1 binding and wrap it with drizzle.
// Only reached when running on Workers (see lib/db/index.ts). A missing binding
// is a configuration error, surfaced explicitly rather than silently degraded.
export function getD1Db(): Db {
  const { env } = getCloudflareContext();
  const d1 = (env as { DB?: D1 }).DB;
  if (!d1) {
    throw new Error(
      "Studiobook: the D1 binding `DB` is not configured on this Worker. " +
        "Add a [[d1_databases]] binding named DB (see apps/web/wrangler.jsonc).",
    );
  }
  return drizzle(d1, { schema });
}
