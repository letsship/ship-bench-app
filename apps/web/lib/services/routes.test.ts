import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as remindersRun } from "@/app/api/reminders/run/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Route handlers run outside a request scope here, so the signed-in session
// check is stubbed; the auth cookie flow itself is covered by e2e.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "operator@example.com" }),
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

describe("POST /api/reminders/run (against injected fake repositories)", () => {
  let repos: Repositories;
  beforeEach(() => {
    // Anchored to the real clock: the route computes the 24h window from
    // `new Date()`, so the seed must contain sessions around today.
    repos = createInMemoryRepositories(buildSeed(new Date()));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("returns 200 and queues pending reminders for confirmed seats starting soon", async () => {
    const res = await remindersRun();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { queued: number; skipped: number };
    expect(body.queued).toBeGreaterThan(0);

    const reminders = (await repos.outbox.listByKind("booking_reminder")).filter(
      (row) => row.sentAt === null,
    );
    expect(reminders).toHaveLength(body.queued);
    const payload = JSON.parse(reminders[0].payload) as { data: { bookingId?: unknown } };
    expect(typeof payload.data.bookingId).toBe("string");
  });

  it("is idempotent: a second call returns 200 and queues no duplicates", async () => {
    const first = await remindersRun();
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { queued: number };
    expect(firstBody.queued).toBeGreaterThan(0);

    const second = await remindersRun();
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { queued: number };
    expect(secondBody.queued).toBe(0);
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(firstBody.queued);
  });
});
