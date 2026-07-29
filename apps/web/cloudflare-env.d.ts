import type { D1Database } from "./lib/db/repos/d1";

// Augments the global `CloudflareEnv` declared by @opennextjs/cloudflare with
// the Worker's own bindings from wrangler.jsonc, so
// `getCloudflareContext().env.DB` is typed.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
