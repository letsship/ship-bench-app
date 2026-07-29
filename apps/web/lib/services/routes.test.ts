import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as remindersRun } from "@/app/api/reminders/run/route";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { startSession } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// `next/headers`'s `cookies()` only works inside a request scope. The reminder
// route is session-guarded, so the route tests swap in an in-memory cookie jar.
const cookieJar = vi.hoisted(() => ({ current: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      cookieJar.current.has(name) ? { value: cookieJar.current.get(name) } : undefined,
    set: (name: string, value: string) => {
      cookieJar.current.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.current.delete(name);
    },
  }),
}));

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/classes returns sessions with occupancy", async () => {
    const res = await classesGet(new NextRequest("http://localhost/api/classes"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty("occupancy");
  });

  it("GET /api/classes honours a from filter", async () => {
    const res = await classesGet(
      new NextRequest("http://localhost/api/classes?from=2099-01-01T00:00:00.000Z"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/invoices returns invoices with a number", async () => {
    const res = await invoicesGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body[0]).toHaveProperty("number");
  });

  it("GET /api/members returns the studio's members", async () => {
    const res = await membersGet();
    expect(res.status).toBe(200);
    expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("POST /api/reminders/run", () => {
  beforeEach(() => {
    cookieJar.current = new Map();
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    cookieJar.current = new Map();
    __setTestRepositories(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await remindersRun();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 200 with a summary when authenticated", async () => {
    await startSession("ops@example.com");
    expect(cookieJar.current.has(SESSION_COOKIE)).toBe(true);

    const res = await remindersRun();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued: number; skipped: number };
    expect(typeof body.queued).toBe("number");
    expect(typeof body.skipped).toBe("number");
  });
});
