import type D1Database from "@cloudflare/workers-types/experimental";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
