import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as remindersPost } from "@/app/api/reminders/run/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

// Mock next/headers at module level so we can override per test
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
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

describe("POST route handlers (with session auth)", () => {
  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(buildSeed(NOW)));
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("POST /api/reminders/run returns 401 without a session", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as { get: (name: string) => undefined });

    const res = await remindersPost();
    expect(res.status).toBe(401);
  });

  it("POST /api/reminders/run returns 200 with a valid session", async () => {
    const token = await createSessionToken("test@example.com");
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === SESSION_COOKIE ? { value: token } : undefined),
    } as { get: (name: string) => { value: string } | undefined });

    const res = await remindersPost();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued?: number; skipped?: number };
    expect(body).toHaveProperty("queued");
    expect(body).toHaveProperty("skipped");
  });

  it("POST /api/reminders/run is idempotent: second call queues no duplicates", async () => {
    const token = await createSessionToken("test@example.com");
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === SESSION_COOKIE ? { value: token } : undefined),
    } as { get: (name: string) => { value: string } | undefined });

    const res1 = await remindersPost();
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { queued?: number };
    const _queued1 = body1.queued ?? 0;

    const res2 = await remindersPost();
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { queued?: number };
    const queued2 = body2.queued ?? 0;

    expect(queued2).toBe(0);
  });
});
