import type { D1Database } from "@cloudflare/workers-types";

// Ambient declarations for the Cloudflare Worker environment. Augments the
// CloudflareEnv global (declared by @opennextjs/cloudflare) with the app's own
// D1 database binding so getCloudflareContext().env.DB is typed as D1Database
// in lib/db/repos/index.ts.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
