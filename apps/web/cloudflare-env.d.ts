/// <reference types="@cloudflare/workers-types" />

// Ambient typing for the Worker's bindings, picked up by
// `@opennextjs/cloudflare`'s `getCloudflareContext().env`. `DB` is the D1
// database the production repositories run against; `ASSETS` serves the static
// OpenNext assets.
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
}
