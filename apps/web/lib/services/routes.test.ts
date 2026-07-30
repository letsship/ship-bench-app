import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as remindersRun } from "@/app/api/reminders/run/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// `cookies()` from next/headers throws outside a real request scope. The
// reminders route gates on requireSession(), so route-level tests stub the
// cookie store to simulate a signed-in (or unsigned) request. Only the
// session-gated POST touches cookies; the GET handlers below never invoke it.
const cookieJar = vi.hoisted(() => ({ store: {} as Record<string, string> }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name in cookieJar.store ? { value: cookieJar.store[name] } : undefined),
    set: (name: string, value: string) => {
      cookieJar.store[name] = value;
    },
    delete: (name: string) => {
      delete cookieJar.store[name];
    },
  }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

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
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
    cookieJar.store = {};
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 401 without a signed-in session", async () => {
    const res = await remindersRun();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 200 with a reminder summary when signed in", async () => {
    cookieJar.store[SESSION_COOKIE] = await createSessionToken("op@example.com");
    const res = await remindersRun();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      queued: number;
      skippedOptedOut: number;
      alreadyQueued: number;
    };
    expect(body).toHaveProperty("queued");
    expect(body).toHaveProperty("skippedOptedOut");
    expect(body).toHaveProperty("alreadyQueued");
    expect(typeof body.queued).toBe("number");
  });
});
