// Augments OpenNext's ambient `CloudflareEnv` (declared by
// `@opennextjs/cloudflare`) with this app's own bindings, so
// `getCloudflareContext().env.DB` is typed in `lib/db/repos/index.ts`.
export {};

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}
