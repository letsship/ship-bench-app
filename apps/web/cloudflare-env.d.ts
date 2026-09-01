/// <reference types="@cloudflare/workers-types" />

// Augments the OpenNext/Cloudflare `CloudflareEnv` global (declared by
// @opennextjs/cloudflare) with this app's own binding, so
// `getCloudflareContext().env.DB` is typed.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
