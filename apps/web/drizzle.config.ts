import { defineConfig } from "drizzle-kit";

// drizzle-kit config for the D1 (SQLite) production database. `pnpm
// db:generate` reads lib/db/schema.ts and emits a migration into
// migrations/, applied to the D1 binding via `wrangler d1 migrations apply`.

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./migrations",
});
