// Augments the `CloudflareEnv` interface (declared globally by
// @opennextjs/cloudflare) with the bindings this Worker actually has, per
// wrangler.jsonc / wrangler.preview.jsonc. Normally produced by `wrangler
// types`; declared by hand here since it's just the one D1 binding.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
