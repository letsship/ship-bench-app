import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: async () => ({ email: "operator@example.com" }) };
});

const NOW = new Date("2026-03-15T12:00:00.000Z");
// Anchored to the real clock, not `NOW`: cancelBooking's rules compare session
// start times against `new Date()`, so this must be genuinely in the future.
const FUTURE = new Date(Date.now() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString();

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

function ownStudioSeed(): SeedData {
  return {
    studio: {
      id: "s1",
      name: "S1",
      slug: "s1",
      timezone: "Europe/Amsterdam",
      createdAt: NOW.toISOString(),
    },
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
        id: "s1-member",
        studioId: "s1",
        name: "Own Member",
        email: "own@example.com",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: NOW.toISOString(),
      },
    ],
    classTypes: [
      {
        id: "s1-class-type",
        studioId: "s1",
        name: "Yoga",
        description: null,
        color: "#111111",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: NOW.toISOString(),
      },
    ],
    sessions: [
      {
        id: "s1-session",
        studioId: "s1",
        classTypeId: "s1-class-type",
        instructor: "Noor",
        startsAt: FUTURE,
        endsAt: FUTURE_END,
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: NOW.toISOString(),
      },
    ],
    bookings: [
      {
        id: "s1-booking",
        sessionId: "s1-session",
        memberId: "s1-member",
        status: "booked",
        bookedAt: NOW.toISOString(),
        cancelledAt: null,
      },
    ],
    invoices: [
      {
        id: "s1-invoice",
        studioId: "s1",
        memberId: "s1-member",
        number: "S1-0001",
        status: "open",
        currency: "EUR",
        taxRateBps: 900,
        subtotalCents: 1000,
        taxCents: 90,
        totalCents: 1090,
        issuedAt: NOW.toISOString(),
        dueAt: null,
        paidAt: null,
        createdAt: NOW.toISOString(),
      },
    ],
    lineItems: [],
    outbox: [],
  };
}

describe("id-scoped route handlers reject cross-studio ids as not found", () => {
  const previousUseFakeBackends = process.env.USE_FAKE_BACKENDS;

  beforeEach(async () => {
    // DELETE /api/bookings/:id builds a real notification provider, which
    // requires either a Resend key or the fake-backends flag.
    process.env.USE_FAKE_BACKENDS = "1";
    const repos = createInMemoryRepositories(ownStudioSeed());
    __setTestRepositories(repos);

    // Seed a second studio's records directly — resolveStudio() always
    // resolves to "s1" (the only row in `studios`), so these ids simulate an
    // id belonging to a different, unresolvable tenant.
    await repos.members.insert({
      id: "s2-member",
      studioId: "s2",
      name: "Other Member",
      email: "other@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });
    await repos.classTypes.insert({
      id: "s2-class-type",
      studioId: "s2",
      name: "Pilates",
      description: null,
      color: "#222222",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      createdAt: NOW.toISOString(),
    });
    await repos.classSessions.insert({
      id: "s2-session",
      studioId: "s2",
      classTypeId: "s2-class-type",
      instructor: "Sanne",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    await repos.bookings.insert({
      id: "s2-booking",
      sessionId: "s2-session",
      memberId: "s2-member",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    await repos.invoices.insert({
      id: "s2-invoice",
      studioId: "s2",
      memberId: "s2-member",
      number: "S2-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 1000,
      taxCents: 90,
      totalCents: 1090,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: NOW.toISOString(),
    });
  });
  afterEach(() => {
    __setTestRepositories(null);
    process.env.USE_FAKE_BACKENDS = previousUseFakeBackends;
  });

  it("GET /api/invoices/:id 404s for another studio's invoice, 200s for its own", async () => {
    const foreign = await invoiceDetailGet(
      new Request("http://localhost/api/invoices/s2-invoice"),
      {
        params: Promise.resolve({ id: "s2-invoice" }),
      },
    );
    expect(foreign.status).toBe(404);

    const own = await invoiceDetailGet(new Request("http://localhost/api/invoices/s1-invoice"), {
      params: Promise.resolve({ id: "s1-invoice" }),
    });
    expect(own.status).toBe(200);
  });

  it("GET /api/members/:id 404s for another studio's member, 200s for its own", async () => {
    const foreign = await memberDetailGet(new Request("http://localhost/api/members/s2-member"), {
      params: Promise.resolve({ id: "s2-member" }),
    });
    expect(foreign.status).toBe(404);

    const own = await memberDetailGet(new Request("http://localhost/api/members/s1-member"), {
      params: Promise.resolve({ id: "s1-member" }),
    });
    expect(own.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for another studio's booking, 200s for its own", async () => {
    const foreign = await bookingDelete(new Request("http://localhost/api/bookings/s2-booking"), {
      params: Promise.resolve({ id: "s2-booking" }),
    });
    expect(foreign.status).toBe(404);

    const own = await bookingDelete(new Request("http://localhost/api/bookings/s1-booking"), {
      params: Promise.resolve({ id: "s1-booking" }),
    });
    expect(own.status).toBe(200);
  });
});
