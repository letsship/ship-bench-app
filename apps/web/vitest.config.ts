import { resolve } from "node:path";
import { defineWorkersProject, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import { defineConfig } from "vitest/config";

// Two projects: the existing plain-`node` project runs every hermetic
// service/repository test against the in-memory fakes; the `workers` project
// runs lib/db/repos/d1.test.ts under Miniflare (a real D1 binding, no native
// SQLite dependency) so the Drizzle-over-D1 implementation gets exercised
// against the actual driver it runs behind in production.

export default defineConfig(async () => {
  const migrations = await readD1Migrations(resolve(__dirname, "migrations"));

  return {
    test: {
      projects: [
        {
          test: {
            name: "node",
            environment: "node",
            include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
            exclude: [
              "lib/db/repos/d1.test.ts",
              "e2e/**",
              "node_modules/**",
              ".next/**",
              ".open-next/**",
            ],
          },
          resolve: {
            alias: {
              "@": resolve(__dirname, "."),
            },
          },
        },
        await defineWorkersProject({
          test: {
            name: "workers",
            include: ["lib/db/repos/d1.test.ts"],
            setupFiles: ["./lib/db/repos/d1.setup.ts"],
            poolOptions: {
              workers: {
                singleWorker: true,
                miniflare: {
                  d1Databases: ["DB"],
                  bindings: { TEST_MIGRATIONS: migrations },
                },
              },
            },
          },
          resolve: {
            alias: {
              "@": resolve(__dirname, "."),
            },
          },
        }),
      ],
    },
  };
});
