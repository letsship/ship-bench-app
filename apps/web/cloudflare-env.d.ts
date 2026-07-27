/// <reference types="@cloudflare/workers-types" />

// Augments the ambient `CloudflareEnv` interface declared by
// @opennextjs/cloudflare with this app's Worker bindings, so
// `getCloudflareContext().env.DB` is typed in the production repository seam.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
