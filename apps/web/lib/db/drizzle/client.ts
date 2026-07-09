/// <reference types="@cloudflare/workers-types" />
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

// The single place that touches the D1 binding, mirroring how
// `lib/supabase/service.ts` was the single place that touched supabase-js.
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}
