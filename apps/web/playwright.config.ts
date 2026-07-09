import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./e2e/support/auth";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // The fake backend is one in-process store, so tests run sequentially and each
  // isolates itself by re-seeding via /api/__test__/reset (see resetBackend).
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // `setup` signs in once and writes storageState; `chromium` depends on it and
    // loads that session, so specs don't re-authenticate per test.
    { name: "setup", testMatch: /support\/auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  // Smoke specs run against a production `next start` server in fake-backends
  // mode (seeded in-memory repositories + fake email provider), so the suite is
  // self-contained — no Supabase/Postgres or Resend account needed.
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
