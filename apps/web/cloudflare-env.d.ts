/// <reference types="@cloudflare/workers-types" />

// Augments @opennextjs/cloudflare's CloudflareEnv with this Worker's own
// bindings declared in wrangler.jsonc. Keeps `getCloudflareContext().env.DB`
// typed as the D1 binding the Drizzle repository adapter expects.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
