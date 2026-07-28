import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "./cookie";

// Next.js 16 regression: `cookies()` from next/headers is asynchronous and
// must be awaited. These tests mock cookies() to return a Promise; if the
// session helpers regressed to synchronous access, they would read `.get` /
// `.set` off a Promise and fail.

type CookieRecord = { name: string; value: string; options?: Record<string, unknown> };

interface FakeStore {
  jar: Map<string, string>;
  get(name: string): { name: string; value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
  getAll(): CookieRecord[];
}

function makeStore(): FakeStore {
  const jar = new Map<string, string>();
  return {
    jar,
    get: (name) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name, value) => void jar.set(name, value),
    delete: (name) => void jar.delete(name),
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
  };
}

const state = vi.hoisted(() => ({ store: null as FakeStore | null, awaited: false }));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve().then(() => {
      state.awaited = true;
      return state.store;
    }),
}));

import { endSession, requireSession, startSession } from "./session";

describe("session helpers (Next 16 async cookies)", () => {
  beforeEach(() => {
    state.store = makeStore();
    state.awaited = false;
  });

  it("startSession awaits cookies() and sets the session cookie", async () => {
    await startSession("operator@riverbank.studio");
    expect(state.awaited).toBe(true);
    expect(state.store!.jar.has(SESSION_COOKIE)).toBe(true);
  });

  it("requireSession awaits cookies() and resolves the signed-in session", async () => {
    await startSession("operator@riverbank.studio");
    state.awaited = false;
    const session = await requireSession();
    expect(state.awaited).toBe(true);
    expect(session.email).toBe("operator@riverbank.studio");
  });

  it("requireSession throws 401 without a cookie", async () => {
    await expect(requireSession()).rejects.toMatchObject({ status: 401 });
    expect(state.awaited).toBe(true);
  });

  it("endSession awaits cookies() and clears the cookie", async () => {
    await startSession("operator@riverbank.studio");
    state.awaited = false;
    await endSession();
    expect(state.awaited).toBe(true);
    expect(state.store!.jar.has(SESSION_COOKIE)).toBe(false);
  });
});
