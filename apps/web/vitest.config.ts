import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "app/**/*.test.ts", "app/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**", ".open-next/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
