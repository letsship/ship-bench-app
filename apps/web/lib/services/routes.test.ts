import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as packageRefundPost } from "@/app/api/packages/[id]/refund/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import type { SeedData } from "@/lib/db/repos/fakes";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// The full requireSession() flow depends on a real request-scoped cookie jar
// (next/headers `cookies()`), which is unavailable when route handlers are
// invoked directly in a unit test. Stub it so POST handlers reach the service
// layer; auth itself is not under test here.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "test@example.com" }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();

// The booking rules compare against the real clock (`new Date()` inside the
// service), so the packages/bookings fixtures below are anchored to it —
// unlike `NOW` above, which only seeds the read-only GET fixtures.
const REAL_NOW = new Date();
const FUTURE = new Date(REAL_NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(REAL_NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function packagesSeed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
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
        createdAt: ISO,
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
        createdAt: ISO,
      },
    ],
    sessions: [
      {
        id: "cs1",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "I",
        startsAt: FUTURE,
        endsAt: FUTURE_END,
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: ISO,
      },
      {
        id: "cs2",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "I",
        startsAt: FUTURE,
        endsAt: FUTURE_END,
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: ISO,
      },
    ],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    packs: [],
  };
}

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

describe("class pack routes (against injected fake repositories)", () => {
  beforeEach(() => {
    // Booking confirmations go through createNotificationProvider(), which
    // requires either a Resend key or the fake-backends flag.
    process.env.USE_FAKE_BACKENDS = "1";
    __setTestRepositories(createInMemoryRepositories(packagesSeed()));
  });
  afterEach(() => {
    delete process.env.USE_FAKE_BACKENDS;
    __setTestRepositories(null);
  });

  it("POST /api/packages buys a pack: 201 with the total price, not per-credit", async () => {
    const res = await packagesPost(
      jsonRequest("http://localhost/api/packages", { memberId: "m1", credits: 5 }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
  });

  it("GET /api/packages?memberId= lists that member's packs newest first: 200", async () => {
    await packagesPost(
      jsonRequest("http://localhost/api/packages", { memberId: "m1", credits: 5 }),
    );
    await packagesPost(
      jsonRequest("http://localhost/api/packages", { memberId: "m1", credits: 10 }),
    );

    const res = await packagesGet(new NextRequest("http://localhost/api/packages?memberId=m1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ creditsTotal: 10 });
    expect(body[1]).toMatchObject({ creditsTotal: 5 });
  });

  it("a booking draws a credit, and an exhausted pack rejects with 402 pack_exhausted", async () => {
    await packagesPost(
      jsonRequest("http://localhost/api/packages", { memberId: "m1", credits: 5 }),
    );
    const packs = (await (
      await packagesGet(new NextRequest("http://localhost/api/packages?memberId=m1"))
    ).json()) as { id: string }[];

    // Book once (draws a credit), then refund the pack outright so the
    // member has no drawable credits left for the next booking.
    const res1 = await bookingsPost(
      jsonRequest("http://localhost/api/bookings", { sessionId: "cs1", memberId: "m1" }),
    );
    expect(res1.status).toBe(201);

    const refundRes = await packageRefundPost(
      new Request(`http://localhost/api/packages/${packs[0].id}/refund`, { method: "POST" }),
      { params: Promise.resolve({ id: packs[0].id }) },
    );
    expect(refundRes.status).toBe(200);
    const refunded = (await refundRes.json()) as Record<string, unknown>;
    expect(refunded).toMatchObject({ creditsRemaining: 0, status: "refunded" });

    const res2 = await bookingsPost(
      jsonRequest("http://localhost/api/bookings", { sessionId: "cs2", memberId: "m1" }),
    );
    expect(res2.status).toBe(402);
    const errorBody = (await res2.json()) as { error: { code: string } };
    expect(errorBody.error.code).toBe("pack_exhausted");
  });

  it("a duplicate booking still rejects with 409 and spends no extra credit", async () => {
    const created = (await (
      await packagesPost(
        jsonRequest("http://localhost/api/packages", { memberId: "m1", credits: 5 }),
      )
    ).json()) as { id: string };

    const first = await bookingsPost(
      jsonRequest("http://localhost/api/bookings", { sessionId: "cs1", memberId: "m1" }),
    );
    expect(first.status).toBe(201);

    const duplicate = await bookingsPost(
      jsonRequest("http://localhost/api/bookings", { sessionId: "cs1", memberId: "m1" }),
    );
    expect(duplicate.status).toBe(409);

    const list = (await (
      await packagesGet(new NextRequest("http://localhost/api/packages?memberId=m1"))
    ).json()) as { id: string; creditsRemaining: number }[];
    expect(list.find((p) => p.id === created.id)?.creditsRemaining).toBe(4);
  });

  it("POST /api/packages/:id/refund voids remaining credits: 200", async () => {
    const created = (await (
      await packagesPost(
        jsonRequest("http://localhost/api/packages", { memberId: "m1", credits: 10 }),
      )
    ).json()) as { id: string };

    const res = await packageRefundPost(
      new Request(`http://localhost/api/packages/${created.id}/refund`, { method: "POST" }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ creditsRemaining: 0, status: "refunded" });
  });
});
