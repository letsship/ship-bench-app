/// <reference types="@cloudflare/workers-types" />

// Bindings this Worker declares in wrangler.jsonc / wrangler.preview.jsonc.
// `@opennextjs/cloudflare` declares `CloudflareEnv` globally; augmenting it here
// is what makes `getCloudflareContext().env.DB` typecheck as a `D1Database`.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
