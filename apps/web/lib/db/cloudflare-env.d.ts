/// <reference types="@cloudflare/workers-types" />

// Augments @opennextjs/cloudflare's global `CloudflareEnv` with the app's own
// D1 binding, so `getCloudflareContext().env.DB` is typed without a manual cast.
interface CloudflareEnv {
  DB: D1Database;
}
