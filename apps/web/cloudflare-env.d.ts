/// <reference types="@cloudflare/workers-types" />

// Types the Worker env exposed by @opennextjs/cloudflare's `CloudflareEnv`
// (see node_modules/@opennextjs/cloudflare/dist/api/cloudflare-context.d.ts)
// with this app's own binding: the D1 database used by `createD1Repositories`.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
