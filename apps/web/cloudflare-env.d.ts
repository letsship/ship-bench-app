import type { D1Database } from "@cloudflare/workers-types";

interface CloudflareEnv {
  DB: D1Database;
}
