import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./lib/db/drizzle/schema.ts",
  out: "./drizzle/migrations",
});
