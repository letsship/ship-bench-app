import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoiceGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "owner@studio.co" }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");
const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

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

describe("cross-studio ownership (IDOR) protections", () => {
  let repos: Repositories;
  let ownStudioId: string;
  const FOREIGN_STUDIO_ID = "other-studio";

  beforeEach(async () => {
    process.env.USE_FAKE_BACKENDS = "1";
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    ownStudioId = (await repos.studios.getFirst())!.id;
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("GET /api/invoices/:id 404s for another studio's invoice and 200s for its own", async () => {
    const ownMember = (await repos.members.listByStudio(ownStudioId))[0];
    const invoiceFields = {
      memberId: ownMember.id,
      number: "OWN-0001",
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
    };
    const ownInvoice = await repos.invoices.insert({
      ...invoiceFields,
      id: "own-inv-1",
      studioId: ownStudioId,
    });
    const foreignInvoice = await repos.invoices.insert({
      ...invoiceFields,
      id: "foreign-inv-1",
      studioId: FOREIGN_STUDIO_ID,
    });

    const okRes = await invoiceGet(
      new NextRequest(`http://localhost/api/invoices/${ownInvoice.id}`),
      paramsFor(ownInvoice.id),
    );
    expect(okRes.status).toBe(200);

    const notFoundRes = await invoiceGet(
      new NextRequest(`http://localhost/api/invoices/${foreignInvoice.id}`),
      paramsFor(foreignInvoice.id),
    );
    expect(notFoundRes.status).toBe(404);
  });

  it("GET /api/members/:id 404s for another studio's member and 200s for its own", async () => {
    const memberFields = {
      name: "Test Member",
      email: "test-member@example.com",
      phone: null,
      status: "active" as const,
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    const ownMember = await repos.members.insert({
      ...memberFields,
      id: "own-member-1",
      studioId: ownStudioId,
    });
    const foreignMember = await repos.members.insert({
      ...memberFields,
      id: "foreign-member-1",
      studioId: FOREIGN_STUDIO_ID,
      email: "foreign-member@example.com",
    });

    const okRes = await memberGet(
      new NextRequest(`http://localhost/api/members/${ownMember.id}`),
      paramsFor(ownMember.id),
    );
    expect(okRes.status).toBe(200);

    const notFoundRes = await memberGet(
      new NextRequest(`http://localhost/api/members/${foreignMember.id}`),
      paramsFor(foreignMember.id),
    );
    expect(notFoundRes.status).toBe(404);
  });

  it("DELETE /api/bookings/:id 404s for another studio's booking and 200s for its own", async () => {
    const classType = (await repos.classTypes.listByStudio(ownStudioId))[0];
    const member = (await repos.members.listByStudio(ownStudioId)).find(
      (m) => m.status === "active",
    )!;
    const realNow = new Date();
    const futureStart = new Date(realNow.getTime() + 7 * 86_400_000).toISOString();
    const futureEnd = new Date(realNow.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

    const ownSession = await repos.classSessions.insert({
      id: "own-session-1",
      studioId: ownStudioId,
      classTypeId: classType.id,
      instructor: "Test Instructor",
      startsAt: futureStart,
      endsAt: futureEnd,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const foreignSession = await repos.classSessions.insert({
      id: "foreign-session-1",
      studioId: FOREIGN_STUDIO_ID,
      classTypeId: classType.id,
      instructor: "Test Instructor",
      startsAt: futureStart,
      endsAt: futureEnd,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });

    const ownBooking = await repos.bookings.insert({
      id: "own-booking-1",
      sessionId: ownSession.id,
      memberId: member.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    const foreignBooking = await repos.bookings.insert({
      id: "foreign-booking-1",
      sessionId: foreignSession.id,
      memberId: member.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });

    const notFoundRes = await bookingDelete(
      new NextRequest(`http://localhost/api/bookings/${foreignBooking.id}`, { method: "DELETE" }),
      paramsFor(foreignBooking.id),
    );
    expect(notFoundRes.status).toBe(404);
    expect((await repos.bookings.getById(foreignBooking.id))?.status).toBe("booked");

    const okRes = await bookingDelete(
      new NextRequest(`http://localhost/api/bookings/${ownBooking.id}`, { method: "DELETE" }),
      paramsFor(ownBooking.id),
    );
    expect(okRes.status).toBe(200);
    expect((await repos.bookings.getById(ownBooking.id))?.status).toBe("cancelled");
  });
});
