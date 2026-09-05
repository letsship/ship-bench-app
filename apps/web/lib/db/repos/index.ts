import { buildSeed } from "../seed-data";
import { createInMemoryRepositories } from "./fakes";
import type { Repositories } from "./types";

// Resolve the request's repositories. Production uses the Cloudflare D1-backed
// implementation; `USE_FAKE_BACKENDS=1` (local dev, `next start` for e2e) uses a
// seeded in-memory set; tests inject their own via __setTestRepositories.

let testRepositories: Repositories | null = null;

export function __setTestRepositories(repositories: Repositories | null): void {
  testRepositories = repositories;
}

function fakeBackendsEnabled(): boolean {
  return process.env.USE_FAKE_BACKENDS === "1";
}

// The fake set is a single seeded instance shared across the whole process.
// It lives on globalThis so Next's separate server chunks (a route handler that
// writes and a page that reads) see the SAME in-memory store.
const globalForFakes = globalThis as unknown as { __studiobookFakeRepos?: Repositories };

export async function resolveRepositories(): Promise<Repositories> {
  if (testRepositories) return testRepositories;
  if (fakeBackendsEnabled()) {
    if (!globalForFakes.__studiobookFakeRepos) {
      globalForFakes.__studiobookFakeRepos = createInMemoryRepositories(buildSeed());
    }
    return globalForFakes.__studiobookFakeRepos;
  }
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  const { createD1Repositories } = await import("./d1");
  return createD1Repositories(env.DB);
}

// Test-only: re-seed the in-memory store to a clean, known dataset so e2e specs
// can isolate per test (via the /api/test-reset endpoint). No-op unless fake
// backends are enabled — the real Supabase path is never touched.
export function resetFakeBackends(): void {
  if (!fakeBackendsEnabled()) return;
  globalForFakes.__studiobookFakeRepos = createInMemoryRepositories(buildSeed());
}
