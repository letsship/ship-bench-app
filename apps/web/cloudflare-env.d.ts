/// <reference types="@cloudflare/workers-types" />

// Augments the global CloudflareEnv interface (declared by
// @opennextjs/cloudflare) with the app's own D1 database binding. The Worker's
// `DB` binding is the production persistence layer — see apps/web/wrangler.jsonc
// and lib/db/repos/d1.ts. `D1Database` comes from @cloudflare/workers-types.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
