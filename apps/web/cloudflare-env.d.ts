// Ambient type declaration for Cloudflare Worker environment bindings.
// D1Database is the type for Cloudflare D1 database bindings.

import type { D1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
