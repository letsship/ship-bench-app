import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as remindersPost } from "@/app/api/reminders/run/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

// The route handlers read the session through next/headers; there is no request
// context in a unit test, so back cookies() with a store the tests control.
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
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
  let repos: Repositories;

  // Seeded against the real clock so the demo dataset genuinely has sessions
  // inside the next 24 hours, which is what the job selects on.
  beforeEach(() => {
    cookieJar.clear();
    repos = createInMemoryRepositories(buildSeed(new Date()));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    cookieJar.clear();
    __setTestRepositories(null);
  });

  const signIn = async (): Promise<void> => {
    cookieJar.set(SESSION_COOKIE, await createSessionToken("owner@example.com"));
  };

  const queued = async (res: Response): Promise<number> =>
    ((await res.json()) as { queued: number }).queued;

  it("requires a signed-in session", async () => {
    const res = await remindersPost();
    expect(res.status).toBe(401);
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(0);
  });

  it("queues reminders and returns 200 with a count", async () => {
    await signIn();
    const res = await remindersPost();
    expect(res.status).toBe(200);

    const count = await queued(res);
    expect(count).toBeGreaterThan(0);
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(count);
  });

  it("is idempotent — a second call queues nothing new", async () => {
    await signIn();
    const first = await remindersPost();
    const count = await queued(first);

    const second = await remindersPost();
    expect(second.status).toBe(200);
    expect(await queued(second)).toBe(0);
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(count);
  });
});
