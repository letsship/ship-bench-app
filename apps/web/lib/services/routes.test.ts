import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoiceGet } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
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

describe("id-scoped route handlers reject cross-studio ids", () => {
  let repos: Repositories;
  let homeInvoiceId: string;
  let homeMemberId: string;
  let homeBookingId: string;
  let foreignInvoiceId: string;
  let foreignMemberId: string;
  let foreignBookingId: string;

  beforeEach(async () => {
    process.env.USE_FAKE_BACKENDS = "1";
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);

    const home = await repos.studios.getFirst();
    if (!home) throw new Error("seed did not produce a studio");
    homeInvoiceId = (await repos.invoices.listByStudio(home.id))[0].id;
    homeMemberId = (await repos.members.listByStudio(home.id))[0].id;
    const homeClassType = (await repos.classTypes.listByStudio(home.id))[0];

    const futureStart = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const futureEnd = new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString();
    const homeSession = await repos.classSessions.insert({
      id: "route-home-session",
      studioId: home.id,
      classTypeId: homeClassType.id,
      instructor: "I",
      startsAt: futureStart,
      endsAt: futureEnd,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const homeBooking = await repos.bookings.insert({
      id: "route-home-booking",
      sessionId: homeSession.id,
      memberId: homeMemberId,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    homeBookingId = homeBooking.id;

    const foreignStudioId = "route-foreign-studio";
    const foreignMember = await repos.members.insert({
      id: "route-foreign-member",
      studioId: foreignStudioId,
      name: "Foreign Member",
      email: "foreign-route@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });
    foreignMemberId = foreignMember.id;

    const foreignInvoice = await repos.invoices.insert({
      id: "route-foreign-invoice",
      studioId: foreignStudioId,
      memberId: foreignMember.id,
      number: "INV-FOREIGN-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 0,
      subtotalCents: 1000,
      taxCents: 0,
      totalCents: 1000,
      issuedAt: NOW.toISOString(),
      dueAt: null,
      paidAt: null,
      createdAt: NOW.toISOString(),
    });
    foreignInvoiceId = foreignInvoice.id;

    const foreignSession = await repos.classSessions.insert({
      id: "route-foreign-session",
      studioId: foreignStudioId,
      classTypeId: "route-foreign-class-type",
      instructor: "Foreign Instructor",
      startsAt: futureStart,
      endsAt: futureEnd,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const foreignBooking = await repos.bookings.insert({
      id: "route-foreign-booking",
      sessionId: foreignSession.id,
      memberId: foreignMember.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    foreignBookingId = foreignBooking.id;
  });
  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("GET /api/invoices/[id] returns 200 for the caller's own invoice", async () => {
    const res = await invoiceGet(
      new NextRequest(`http://localhost/api/invoices/${homeInvoiceId}`),
      {
        params: Promise.resolve({ id: homeInvoiceId }),
      },
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/invoices/[id] 404s for another studio's invoice", async () => {
    const res = await invoiceGet(
      new NextRequest(`http://localhost/api/invoices/${foreignInvoiceId}`),
      { params: Promise.resolve({ id: foreignInvoiceId }) },
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/members/[id] returns 200 for the caller's own member", async () => {
    const res = await memberGet(new NextRequest(`http://localhost/api/members/${homeMemberId}`), {
      params: Promise.resolve({ id: homeMemberId }),
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/members/[id] 404s for another studio's member", async () => {
    const res = await memberGet(
      new NextRequest(`http://localhost/api/members/${foreignMemberId}`),
      { params: Promise.resolve({ id: foreignMemberId }) },
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /api/bookings/[id] cancels the caller's own booking", async () => {
    const res = await bookingDelete(
      new NextRequest(`http://localhost/api/bookings/${homeBookingId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: homeBookingId }) },
    );
    expect(res.status).toBe(200);
    expect((await repos.bookings.getById(homeBookingId))?.status).toBe("cancelled");
  });

  it("DELETE /api/bookings/[id] 404s for another studio's booking and leaves it active", async () => {
    const res = await bookingDelete(
      new NextRequest(`http://localhost/api/bookings/${foreignBookingId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: foreignBookingId }) },
    );
    expect(res.status).toBe(404);
    expect((await repos.bookings.getById(foreignBookingId))?.status).toBe("booked");
  });
});
