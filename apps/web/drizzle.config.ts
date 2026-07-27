import { defineConfig } from "drizzle-kit";

// Lets drizzle-kit generate/verify the D1 migration SQL from `lib/db/schema.ts`.
// The migration under `migrations/` is applied by wrangler (see
// `wrangler.jsonc`'s `d1_databases[].migrations_dir`), not by drizzle-kit at
// runtime — this config exists for local schema authoring only.
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./migrations",
});
