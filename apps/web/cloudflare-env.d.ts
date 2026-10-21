/// <reference types="@cloudflare/workers-types" />

// Ambient Worker environment typing so getCloudflareContext().env (from
// @opennextjs/cloudflare) exposes the D1 database binding used by the
// production repository adapter.
interface CloudflareEnv {
  DB: D1Database;
}
