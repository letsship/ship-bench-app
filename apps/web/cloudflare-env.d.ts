import type { D1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    ASSETS: Fetcher;
    DB: D1Database;
  }
}

export {};
