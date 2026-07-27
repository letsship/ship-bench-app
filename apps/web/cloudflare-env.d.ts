/// <reference types="@cloudflare/workers-types" />

// Types the Worker's `DB` binding (see wrangler.jsonc's `d1_databases`) onto
// the ambient `CloudflareEnv` interface that @opennextjs/cloudflare's
// `getCloudflareContext()` returns, so `env.DB` is typed in resolveRepositories.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
