import type { D1Database as WorkersD1Database } from "@cloudflare/workers-types";

// Worker binding types. @opennextjs/cloudflare declares the global
// `CloudflareEnv` interface (with ASSETS etc.); this augmentation adds the
// bindings from wrangler.jsonc that the app itself uses. The global
// `D1Database` alias also lets drizzle-orm/d1 resolve the binding type without
// pulling the full workers-types globals (which would clash with lib.dom).
declare global {
  type D1Database = WorkersD1Database;

  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
