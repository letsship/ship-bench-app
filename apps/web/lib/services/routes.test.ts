import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as remindersRun } from "@/app/api/reminders/run/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// requireSession reads next/headers cookies, which vitest runs outside a Next
// request scope — back them with an in-memory jar the tests control.
const cookieJar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
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
  // The route runs against the real clock, so the seeded session must genuinely
  // start within the next 24 hours.
  function reminderSeed(): SeedData {
    const iso = new Date().toISOString();
    const startsAt = new Date(Date.now() + 2 * 3_600_000).toISOString();
    return {
      studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: iso },
      settings: {
        studioId: "s1",
        currency: "EUR",
        taxRateBps: 0,
        cancellationWindowHours: 12,
        waitlistEnabled: true,
        notifyBookingConfirmations: true,
        notifyCancellations: true,
        notifyWaitlistPromotions: true,
        notifyInvoices: true,
      },
      members: [
        {
          id: "m1",
          studioId: "s1",
          name: "M1",
          email: "m1@e.co",
          phone: null,
          status: "active",
          notificationsOptedOut: false,
          createdAt: iso,
        },
      ],
      classTypes: [
        {
          id: "ct1",
          studioId: "s1",
          name: "Yoga",
          description: null,
          color: "#111111",
          defaultCapacity: 10,
          defaultPriceCents: 1000,
          createdAt: iso,
        },
      ],
      sessions: [
        {
          id: "cs1",
          studioId: "s1",
          classTypeId: "ct1",
          instructor: "I",
          startsAt,
          endsAt: startsAt,
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: iso,
        },
      ],
      bookings: [
        {
          id: "b1",
          sessionId: "cs1",
          memberId: "m1",
          status: "booked",
          bookedAt: iso,
          cancelledAt: null,
        },
      ],
      invoices: [],
      lineItems: [],
      outbox: [],
    };
  }

  let repos: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    repos = createInMemoryRepositories(reminderSeed());
    __setTestRepositories(repos);
    process.env.USE_FAKE_BACKENDS = "1";
    cookieJar.clear();
  });
  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
    cookieJar.clear();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await remindersRun();
    expect(res.status).toBe(401);
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(0);
  });

  it("queues pending reminders once, and is idempotent on a re-run", async () => {
    cookieJar.set(SESSION_COOKIE, await createSessionToken("owner@example.com"));

    const first = await remindersRun();
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ queued: 1, skipped: 0 });
    const rows = await repos.outbox.listByKind("booking_reminder");
    expect(rows).toHaveLength(1);
    expect(rows[0].sentAt).toBeNull();

    const second = await remindersRun();
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ queued: 0, skipped: 1 });
    expect(await repos.outbox.listByKind("booking_reminder")).toHaveLength(1);
  });
});
