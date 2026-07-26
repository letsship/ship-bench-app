import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// requireSession() reads the session cookie via next/headers `cookies()`. There
// is no request context in a unit test, so stub it with a controllable jar —
// tests set/clear a real signed token via createSessionToken/SESSION_COOKIE.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

describe("POST /api/reminders/run", () => {
  beforeEach(async () => {
    const { __setTestRepositories } = await import("@/lib/db/repos");
    const { createInMemoryRepositories } = await import("@/lib/db/repos/fakes");
    const { buildSeed } = await import("@/lib/db/seed-data");
    __setTestRepositories(
      createInMemoryRepositories(buildSeed(new Date("2026-03-15T12:00:00.000Z"))),
    );
  });

  afterEach(async () => {
    const { __setTestRepositories } = await import("@/lib/db/repos");
    __setTestRepositories(null);
    cookieJar.clear();
  });

  it("401s without a signed-in session", async () => {
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("200s and returns a queued summary when signed in", async () => {
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth/session");
    cookieJar.set(SESSION_COOKIE, await createSessionToken("operator@riverbank.studio"));

    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued: number };
    expect(typeof body.queued).toBe("number");
  });
});
