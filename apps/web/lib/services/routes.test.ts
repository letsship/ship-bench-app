import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as remindersRun } from "@/app/api/reminders/run/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const cookieJar = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE && cookieJar.value ? { value: cookieJar.value } : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("GET route handlers (against injected fake repositories)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    cookieJar.value = null;
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
  const NOW = new Date("2026-03-15T12:00:00.000Z");

  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });
  afterEach(() => {
    __setTestRepositories(null);
    cookieJar.value = null;
  });

  it("returns 401 without a session", async () => {
    const res = await remindersRun();
    expect(res.status).toBe(401);
  });

  it("returns 200 and queues reminders with a signed-in session", async () => {
    cookieJar.value = await createSessionToken("owner@example.com");
    const res = await remindersRun();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued: number };
    expect(body.queued).toBeGreaterThanOrEqual(0);
  });

  it("does not queue duplicate reminders on a second run", async () => {
    cookieJar.value = await createSessionToken("owner@example.com");
    const first = (await (await remindersRun()).json()) as { queued: number };
    const second = (await (await remindersRun()).json()) as { queued: number };
    expect(second.queued).toBe(0);
    expect(first.queued).toBeGreaterThanOrEqual(second.queued);
  });
});
