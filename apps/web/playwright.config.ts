import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Smoke specs run against a production `next start` server in fake-backends
  // mode (seeded in-memory repositories + fake email provider), so the suite is
  // self-contained — no Supabase/Postgres or Cloudflare Email account needed.
  webServer: {
    command: "pnpm run build && pnpm run start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      USE_FAKE_BACKENDS: "1",
      PORT: String(PORT),
    },
  },
});
