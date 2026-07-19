// Augment the global CloudflareEnv interface to include the D1 database binding.
// D1Database is a global type from Cloudflare Workers runtime.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
