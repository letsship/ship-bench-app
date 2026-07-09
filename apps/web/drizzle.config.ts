import { defineConfig } from "drizzle-kit";

// Config for `drizzle-kit generate` only (schema.ts -> SQL migrations under
// migrations/). Applying migrations to D1 goes through `wrangler d1
// migrations apply`, not drizzle-kit, so no `driver`/`dbCredentials` (which
// would require live Cloudflare account credentials) are needed here.
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./migrations",
});
