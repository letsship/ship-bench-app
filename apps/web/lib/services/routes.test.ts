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
import { buildSeed } from "@/lib/db/seed-data";

// The mutating handlers call requireSession(), which reads a cookie store that
// only exists inside a Next request. These tests exercise tenant scoping, not
// auth, so stand in a signed-in operator.
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

// Two tenants share the store: the caller resolves to studio "s1", while "s2"
// rows stand in for another studio's data. Guessing an "s2" id must read as a
// plain 404 — never a leak, never a mutation.
const REAL_NOW = new Date();
const ISO = REAL_NOW.toISOString();
const FUTURE = new Date(REAL_NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(REAL_NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function twoStudioSeed(): SeedData {
  const memberOf = (id: string, studioId: string) => ({
    id,
    studioId,
    name: id,
    email: `${id}@e.co`,
    phone: null,
    status: "active" as const,
    notificationsOptedOut: false,
    createdAt: ISO,
  });
  const sessionOf = (id: string, studioId: string) => ({
    id,
    studioId,
    classTypeId: "ct1",
    instructor: "I",
    startsAt: FUTURE,
    endsAt: FUTURE_END,
    capacity: 10,
    priceCents: 1000,
    status: "scheduled" as const,
    createdAt: ISO,
  });
  const invoiceOf = (id: string, studioId: string, memberId: string) => ({
    id,
    studioId,
    memberId,
    number: `INV-2026-${id}`,
    status: "open" as const,
    currency: "EUR",
    taxRateBps: 900,
    subtotalCents: 1000,
    taxCents: 90,
    totalCents: 1090,
    issuedAt: ISO,
    dueAt: FUTURE,
    paidAt: null,
    createdAt: ISO,
  });
  const bookingOf = (id: string, sessionId: string, memberId: string) => ({
    id,
    sessionId,
    memberId,
    status: "booked" as const,
    bookedAt: ISO,
    cancelledAt: null,
  });

  return {
    studio: { id: "s1", name: "Mine", slug: "mine", timezone: "Europe/Amsterdam", createdAt: ISO },
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
    members: [memberOf("m1", "s1"), memberOf("m2", "s2")],
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
    sessions: [sessionOf("cs1", "s1"), sessionOf("cs2", "s2")],
    bookings: [bookingOf("b1", "cs1", "m1"), bookingOf("b2", "cs2", "m2")],
    invoices: [invoiceOf("i1", "s1", "m1"), invoiceOf("i2", "s2", "m2")],
    lineItems: [],
    outbox: [],
  };
}

describe("[id] route handlers are scoped to the caller's studio", () => {
  beforeEach(() => {
    // The DELETE handler builds a real notification provider; the fake one keeps
    // the test hermetic (repositories still come from __setTestRepositories).
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
    __setTestRepositories(createInMemoryRepositories(twoStudioSeed()));
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.unstubAllEnvs();
  });

  it("GET /api/invoices/:id returns an own-studio invoice", async () => {
    const res = await invoiceGet(new NextRequest("http://localhost/api/invoices/i1"), params("i1"));
    expect(res.status).toBe(200);
    expect((await res.json()) as { invoice: { id: string } }).toMatchObject({
      invoice: { id: "i1" },
    });
  });

  it("GET /api/invoices/:id 404s for another studio's invoice", async () => {
    const res = await invoiceGet(new NextRequest("http://localhost/api/invoices/i2"), params("i2"));
    expect(res.status).toBe(404);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "not_found" },
    });
  });

  it("GET /api/members/:id returns an own-studio member", async () => {
    const res = await memberGet(new NextRequest("http://localhost/api/members/m1"), params("m1"));
    expect(res.status).toBe(200);
    expect((await res.json()) as { id: string }).toMatchObject({ id: "m1" });
  });

  it("GET /api/members/:id 404s for another studio's member", async () => {
    const res = await memberGet(new NextRequest("http://localhost/api/members/m2"), params("m2"));
    expect(res.status).toBe(404);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "not_found" },
    });
  });

  it("DELETE /api/bookings/:id cancels an own-studio booking", async () => {
    const res = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/b1", { method: "DELETE" }),
      params("b1"),
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for another studio's booking and leaves it booked", async () => {
    const repos = createInMemoryRepositories(twoStudioSeed());
    __setTestRepositories(repos);
    const res = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/b2", { method: "DELETE" }),
      params("b2"),
    );
    expect(res.status).toBe(404);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "not_found" },
    });
    const untouched = await repos.bookings.getById("b2");
    expect(untouched?.status).toBe("booked");
    expect(untouched?.cancelledAt).toBeNull();
  });
});
