import type { D1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    NEXT_PUBLIC_SITE_URL: string;
    RESEND_API_KEY: string;
  }
}
