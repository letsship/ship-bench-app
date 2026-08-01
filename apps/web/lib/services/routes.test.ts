import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoiceGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { Invoice } from "@/lib/db/types";
import { buildSeed } from "@/lib/db/seed-data";

// The booking DELETE handler requires an operator session; there is no request
// scope in vitest, so stub the session check itself.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "owner@example.com" }),
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

describe("[id] route handlers are scoped to the caller's studio", () => {
  // The booking cancellation rules compare against the real clock, so the own
  // session must be genuinely in the future.
  const ISO = new Date().toISOString();
  const FUTURE = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const FUTURE_END = new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString();

  const invoiceRow = (id: string, studioId: string, memberId: string): Invoice => ({
    id,
    studioId,
    memberId,
    number: `2026-${id}`,
    status: "open",
    currency: "EUR",
    taxRateBps: 900,
    subtotalCents: 1000,
    taxCents: 90,
    totalCents: 1090,
    issuedAt: ISO,
    dueAt: null,
    paidAt: null,
    createdAt: ISO,
  });

  // Studio "s1" is the caller's (the only studio row, so resolveStudio picks
  // it); the "s2" rows exist only to be reached via a guessed id.
  const seed = (): SeedData => ({
    studio: { id: "s1", name: "Own", slug: "own", timezone: "Europe/Amsterdam", createdAt: ISO },
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
        name: "Own member",
        email: "own@e.co",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: ISO,
      },
      {
        id: "m2",
        studioId: "s2",
        name: "Foreign member",
        email: "foreign@e.co",
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
        studioId: "s2",
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
    bookings: [
      {
        id: "b1",
        sessionId: "cs1",
        memberId: "m1",
        status: "booked",
        bookedAt: ISO,
        cancelledAt: null,
      },
      {
        id: "b2",
        sessionId: "cs2",
        memberId: "m2",
        status: "booked",
        bookedAt: ISO,
        cancelledAt: null,
      },
    ],
    invoices: [invoiceRow("inv1", "s1", "m1"), invoiceRow("inv2", "s2", "m2")],
    lineItems: [],
    outbox: [],
  });

  const routeContext = (id: string): { params: Promise<{ id: string }> } => ({
    params: Promise.resolve({ id }),
  });

  let repos: Repositories;
  beforeEach(() => {
    // The DELETE handler builds a notification provider; use the fake one.
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    repos = createInMemoryRepositories(seed());
    __setTestRepositories(repos);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id returns an own-studio invoice", async () => {
    const res = await invoiceGet(
      new NextRequest("http://localhost/api/invoices/inv1"),
      routeContext("inv1"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: { id: string } };
    expect(body.invoice.id).toBe("inv1");
  });

  it("GET /api/invoices/:id 404s a foreign-studio invoice", async () => {
    const res = await invoiceGet(
      new NextRequest("http://localhost/api/invoices/inv2"),
      routeContext("inv2"),
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id returns an own-studio member", async () => {
    const res = await memberGet(
      new NextRequest("http://localhost/api/members/m1"),
      routeContext("m1"),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe("m1");
  });

  it("GET /api/members/:id 404s a foreign-studio member", async () => {
    const res = await memberGet(
      new NextRequest("http://localhost/api/members/m2"),
      routeContext("m2"),
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /api/bookings/:id cancels an own-studio booking", async () => {
    const res = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/b1", { method: "DELETE" }),
      routeContext("b1"),
    );
    expect(res.status).toBe(200);
    expect((await repos.bookings.getById("b1"))?.status).toBe("cancelled");
  });

  it("DELETE /api/bookings/:id 404s a foreign-studio booking without cancelling it", async () => {
    const res = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/b2", { method: "DELETE" }),
      routeContext("b2"),
    );
    expect(res.status).toBe(404);
    const untouched = await repos.bookings.getById("b2");
    expect(untouched?.status).toBe("booked");
    expect(untouched?.cancelledAt).toBeNull();
  });
});
