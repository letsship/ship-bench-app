/// <reference types="@cloudflare/workers-types" />

// Ambient typing for the Worker's bindings, merged into `CloudflareEnv`
// (declared by @opennextjs/cloudflare) so `getCloudflareContext().env.DB` is
// typed. Mirrors the `d1_databases` binding declared in wrangler.jsonc.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
