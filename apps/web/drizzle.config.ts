import { defineConfig } from "drizzle-kit";

// drizzle-kit config for regenerating D1 migrations from lib/db/schema.ts.
// Run `pnpm --filter @studiobook/web exec drizzle-kit generate` after changing
// the schema to produce a new file under packages/db/migrations.
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./lib/db/schema.ts",
  out: "../../packages/db/migrations",
});
