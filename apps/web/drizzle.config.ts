import { defineConfig } from "drizzle-kit";

// drizzle-kit config for the D1 schema. Generates the SQLite DDL consumed by
// `wrangler d1 migrations apply` from `lib/db/schema.ts`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "../../packages/db/migrations/d1",
});
