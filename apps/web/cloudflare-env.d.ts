/// <reference types="@cloudflare/workers-types" />
// Ambient declaration for the Worker's `DB` D1 binding, consumed via
// `getCloudflareContext().env.DB` in `lib/db/repos/index.ts`. Augmenting the
// `CloudflareEnv` interface (declared by `@opennextjs/cloudflare`) makes the
// binding typed without pulling the full Cloudflare globals into app code.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
