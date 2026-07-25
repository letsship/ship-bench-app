// Type declarations for Cloudflare environment bindings
import type { D1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ASSETS: Record<string, string>;
  }
}

export {};
