// Type definition for Cloudflare Worker environment bindings.
// The DB binding is a Cloudflare D1 database for use in resolveRepositories().

import type { D1Database } from "drizzle-orm/d1";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
