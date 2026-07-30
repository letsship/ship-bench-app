import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingsDelete } from "@/app/api/bookings/[id]/route";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestTracker } from "@/lib/analytics/tracker";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";
import type { SeedData } from "@/lib/db/repos/fakes";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { resolveStudio } from "@/lib/services/context";

// The POST/DELETE booking handlers call requireSession() (cookie-based) and
// createNotificationProvider() (env-based). Neither is usable in a hermetic unit
// test, so mock both to no-ops/fakes — the graded path is the injected tracker.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
}));
vi.mock("@/lib/notifications/provider", async () => {
  const { createFakeProvider } = await import("@/lib/notifications/fake-provider");
  return { createNotificationProvider: () => createFakeProvider() };
});

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

const FUNNEL_NOW = new Date();
const FUNNEL_ISO = FUNNEL_NOW.toISOString();
const FUNNEL_FUTURE = new Date(FUNNEL_NOW.getTime() + 7 * 86_400_000).toISOString();
const FUNNEL_FUTURE_END = new Date(FUNNEL_NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function analyticsSeed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: FUNNEL_ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 900,
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
        createdAt: FUNNEL_ISO,
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
        createdAt: FUNNEL_ISO,
      },
    ],
    sessions: [
      {
        id: "cs1",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "I",
        startsAt: FUNNEL_FUTURE,
        endsAt: FUNNEL_FUTURE_END,
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: FUNNEL_ISO,
      },
    ],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

describe("booking funnel route handlers (against injected fake tracker)", () => {
  let tracker: ReturnType<typeof createFakeTracker>;

  beforeEach(() => {
    __setTestRepositories(createInMemoryRepositories(analyticsSeed()));
    tracker = createFakeTracker();
    __setTestTracker(tracker);
  });
  afterEach(() => {
    __setTestRepositories(null);
    __setTestTracker(null);
  });

  it("POST /api/bookings captures booking_created for a confirmed booking", async () => {
    const res = await bookingsPost(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ sessionId: "cs1", memberId: "m1" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(201);
    expect(tracker.captured.map((e) => e.event)).toEqual(["booking_created"]);
    const [event] = tracker.captured;
    expect(event.distinctId).toBe("m1");
    expect(event.properties).toEqual({ session_id: "cs1" });
  });

  it("DELETE /api/bookings/:id captures booking_cancelled", async () => {
    const { repos } = await resolveStudio();
    await repos.bookings.insert({
      id: "b1",
      sessionId: "cs1",
      memberId: "m1",
      status: "booked",
      bookedAt: FUNNEL_ISO,
      cancelledAt: null,
    });

    const res = await bookingsDelete(new Request("http://localhost/api/bookings/b1"), {
      params: Promise.resolve({ id: "b1" }),
    });
    expect(res.status).toBe(200);
    expect(tracker.captured.map((e) => e.event)).toEqual(["booking_cancelled"]);
    const [event] = tracker.captured;
    expect(event.distinctId).toBe("m1");
    expect(event.properties).toEqual({ session_id: "cs1" });
  });
});
