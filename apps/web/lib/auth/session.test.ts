import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, endSession, getSession, requireSession, startSession } from "./session";

// Mock the Next 16 async cookies() API with an in-memory jar.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  })),
}));

describe("session helpers (awaited cookies store)", () => {
  beforeEach(() => {
    jar.clear();
  });

  it("returns null when no session cookie is present", async () => {
    expect(await getSession()).toBeNull();
  });

  it("round-trips startSession -> getSession", async () => {
    await startSession("operator@riverbank.studio");
    expect(jar.has(SESSION_COOKIE)).toBe(true);
    expect(await getSession()).toEqual({ email: "operator@riverbank.studio" });
  });

  it("rejects a tampered session cookie", async () => {
    await startSession("operator@riverbank.studio");
    jar.set(SESSION_COOKIE, `${jar.get(SESSION_COOKIE)}tampered`);
    expect(await getSession()).toBeNull();
  });

  it("requireSession throws 401 without a session", async () => {
    await expect(requireSession()).rejects.toMatchObject({ status: 401 });
  });

  it("requireSession returns the session when signed in", async () => {
    await startSession("operator@riverbank.studio");
    expect(await requireSession()).toEqual({ email: "operator@riverbank.studio" });
  });

  it("endSession clears the cookie", async () => {
    await startSession("operator@riverbank.studio");
    await endSession();
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await getSession()).toBeNull();
  });
});
