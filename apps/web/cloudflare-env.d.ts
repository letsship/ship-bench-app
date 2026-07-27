/// <reference types="@cloudflare/workers-types" />

// Ambient typing for the Worker's Cloudflare bindings, merged into the
// `CloudflareEnv` interface declared by @opennextjs/cloudflare. Lets
// `getCloudflareContext().env.DB` resolve to a typed D1Database.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    NEXT_PUBLIC_SITE_URL?: string;
  }
}

export {};
