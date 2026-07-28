/// <reference types="@cloudflare/workers-types" />

// Ambient declaration merging: add the Studiobook D1 binding to the Worker env
// interface that @opennextjs/cloudflare already declares globally. This types
// `getCloudflareContext().env.DB` as a `D1Database` in `resolveRepositories`.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
