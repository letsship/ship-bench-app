import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoiceDetailGet, PATCH as invoiceDetailPatch } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// The detail delete/patch routes gate on a signed-in session. The route-level
// scoping tests only exercise the tenant check, so bypass auth here.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "t@e.co" }),
  SESSION_COOKIE: "studiobook_session",
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

// Route-level IDOR guard: by-id detail endpoints must reject an id owned by a
// different studio as 404 while still serving the caller's own records.
describe("cross-tenant detail routes (IDOR)", () => {
  const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
  const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
  // cancelBooking compares against the real wall clock (`new Date()`), so the
  // own-studio booking must sit in the real future, not the seeded NOW.
  const REAL_FUTURE = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const REAL_FUTURE_END = new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString();
  let prevFakeBackends: string | undefined;

  function foreignSeed(): {
    repos: ReturnType<typeof createInMemoryRepositories>;
    ownMemberId: string;
    ownInvoiceId: string;
    ownBookingId: string;
  } {
    const seed: SeedData = buildSeed(NOW);
    const ownMemberId = seed.members[0].id;
    const ownInvoiceId = seed.invoices[0].id;
    const ownBookingId = "ob1";
    const withForeign: SeedData = {
      ...seed,
      members: [
        ...seed.members,
        {
          id: "fm1",
          studioId: "s2",
          name: "Foreign",
          email: "fm1@e.co",
          phone: null,
          status: "active",
          notificationsOptedOut: false,
          createdAt: NOW.toISOString(),
        },
      ],
      sessions: [
        ...seed.sessions,
        {
          id: "fs1",
          studioId: "s2",
          classTypeId: seed.classTypes[0].id,
          instructor: "X",
          startsAt: FUTURE,
          endsAt: FUTURE_END,
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: NOW.toISOString(),
        },
        {
          id: "os1",
          studioId: seed.studio.id,
          classTypeId: seed.classTypes[0].id,
          instructor: "I",
          startsAt: REAL_FUTURE,
          endsAt: REAL_FUTURE_END,
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: NOW.toISOString(),
        },
      ],
      bookings: [
        ...seed.bookings,
        {
          id: "fb1",
          sessionId: "fs1",
          memberId: "fm1",
          status: "booked",
          bookedAt: NOW.toISOString(),
          cancelledAt: null,
        },
        {
          id: ownBookingId,
          sessionId: "os1",
          memberId: ownMemberId,
          status: "booked",
          bookedAt: NOW.toISOString(),
          cancelledAt: null,
        },
      ],
      invoices: [
        ...seed.invoices,
        {
          id: "fi1",
          studioId: "s2",
          memberId: "fm1",
          number: "INV-F-1",
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
    };
    return {
      repos: createInMemoryRepositories(withForeign),
      ownMemberId,
      ownInvoiceId,
      ownBookingId,
    };
  }

  beforeEach(() => {
    // createNotificationProvider() would otherwise throw without RESEND_API_KEY;
    // the fake provider is fine because resolveRepositories() still returns the
    // injected test repositories first.
    prevFakeBackends = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
  });
  afterEach(() => {
    __setTestRepositories(null);
    if (prevFakeBackends === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = prevFakeBackends;
  });

  it("GET /api/invoices/:id 404s for a foreign invoice, 200s for own", async () => {
    const { repos, ownInvoiceId } = foreignSeed();
    __setTestRepositories(repos);

    const foreign = await invoiceDetailGet(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: "fi1" }),
    });
    expect(foreign.status).toBe(404);

    const own = await invoiceDetailGet(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: ownInvoiceId }),
    });
    expect(own.status).toBe(200);
  });

  it("PATCH /api/invoices/:id 404s for a foreign invoice, 200s for own", async () => {
    const { repos, ownInvoiceId } = foreignSeed();
    __setTestRepositories(repos);

    const foreign = await invoiceDetailPatch(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      { params: Promise.resolve({ id: "fi1" }) },
    );
    expect(foreign.status).toBe(404);
    const foreignStill = await repos.invoices.getById("fi1");
    expect(foreignStill?.status).toBe("open");
    expect(foreignStill?.paidAt).toBeNull();

    const own = await invoiceDetailPatch(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "refunded" }),
      }),
      { params: Promise.resolve({ id: ownInvoiceId }) },
    );
    expect(own.status).toBe(200);
  });

  it("GET /api/members/:id 404s for a foreign member, 200s for own", async () => {
    const { repos, ownMemberId } = foreignSeed();
    __setTestRepositories(repos);

    const foreign = await memberDetailGet(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: "fm1" }),
    });
    expect(foreign.status).toBe(404);

    const own = await memberDetailGet(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: ownMemberId }),
    });
    expect(own.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for a foreign booking, 200s for own", async () => {
    const { repos, ownBookingId } = foreignSeed();
    __setTestRepositories(repos);

    const foreign = await bookingDelete(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: "fb1" }),
    });
    expect(foreign.status).toBe(404);
    const foreignStill = await repos.bookings.getById("fb1");
    expect(foreignStill?.status).toBe("booked");
    expect(foreignStill?.cancelledAt).toBeNull();

    const own = await bookingDelete(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: ownBookingId }),
    });
    expect(own.status).toBe(200);
  });
});
