import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig uses jsx: "preserve" (Next compiles it), so tell esbuild to use the
  // automatic runtime here — otherwise component tests hit "React is not defined".
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**", ".open-next/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
