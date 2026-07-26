/// <reference types="@cloudflare/workers-types" />

// Ambient typing for the Worker's bindings. `CloudflareEnv` is declared by
// `@opennextjs/cloudflare` (see its `cloudflare-context.ts`); this file adds
// our own binding so `getCloudflareContext().env.DB` typechecks.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
