/// <reference types="@cloudflare/workers-types" />

// Worker binding types. `CloudflareEnv` is the global interface
// `@opennextjs/cloudflare` reads through `getCloudflareContext().env`; declaring
// `DB` here is what makes the D1 binding from wrangler.jsonc visible to
// TypeScript in `lib/db/repos/index.ts`.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
