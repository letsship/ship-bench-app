/// <reference types="@cloudflare/workers-types" />

// Ambient typing for the Worker's Cloudflare bindings. `@opennextjs/cloudflare`
// declares the global `CloudflareEnv` interface (see cloudflare-context.d.ts);
// this file merges in Studiobook's own bindings so `getCloudflareContext().env`
// is fully typed.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    NEXT_PUBLIC_SITE_URL?: string;
  }
}

export {};
