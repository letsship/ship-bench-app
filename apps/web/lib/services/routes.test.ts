import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

// Detail-route mutations require a session; the fixture auth reads cookies,
// which don't exist in the hermetic test run, so stub the guard.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  requireSession: async () => ({ email: "operator@example.com" }),
}));

const req = () => new NextRequest("http://localhost/api/x");
const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

async function seedForeignRecords(
  repos: Repositories,
  studioId: string,
): Promise<{ foreignInvoiceId: string; foreignMemberId: string; foreignBookingId: string }> {
  const memberId = (await repos.members.listByStudio(studioId))[0].id;
  const classTypeId = (await repos.classTypes.listByStudio(studioId))[0].id;
  await repos.members.insert({
    id: "foreign-member",
    studioId: "s2",
    name: "Other Studio Member",
    email: "other@example.com",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: NOW.toISOString(),
  });
  await repos.invoices.insert({
    id: "foreign-invoice",
    studioId: "s2",
    memberId,
    number: "INV-2026-9999",
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
  await repos.classSessions.insert({
    id: "foreign-session",
    studioId: "s2",
    classTypeId,
    instructor: "I",
    startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString(),
    capacity: 10,
    priceCents: 1000,
    status: "scheduled",
    createdAt: NOW.toISOString(),
  });
  await repos.bookings.insert({
    id: "foreign-booking",
    sessionId: "foreign-session",
    memberId,
    status: "booked",
    bookedAt: NOW.toISOString(),
    cancelledAt: null,
  });
  return {
    foreignInvoiceId: "foreign-invoice",
    foreignMemberId: "foreign-member",
    foreignBookingId: "foreign-booking",
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

describe("detail route handlers are scoped to the caller's studio", () => {
  let repos: Repositories;
  let studioId: string;
  beforeEach(async () => {
    process.env.USE_FAKE_BACKENDS = "1";
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    studioId = (await repos.studios.getFirst())?.id ?? "";
  });
  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("GET /api/invoices/:id returns an invoice owned by the caller's studio", async () => {
    const invoice = (await repos.invoices.listByStudio(studioId))[0];
    const res = await invoiceDetailGet(req(), ctxOf(invoice.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: { id: string } };
    expect(body.invoice.id).toBe(invoice.id);
  });

  it("GET /api/invoices/:id 404s for an invoice owned by another studio", async () => {
    const { foreignInvoiceId } = await seedForeignRecords(repos, studioId);
    const res = await invoiceDetailGet(req(), ctxOf(foreignInvoiceId));
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id returns a member owned by the caller's studio", async () => {
    const member = (await repos.members.listByStudio(studioId))[0];
    const res = await memberDetailGet(req(), ctxOf(member.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(member.id);
  });

  it("GET /api/members/:id 404s for a member owned by another studio", async () => {
    const { foreignMemberId } = await seedForeignRecords(repos, studioId);
    const res = await memberDetailGet(req(), ctxOf(foreignMemberId));
    expect(res.status).toBe(404);
  });

  it("DELETE /api/bookings/:id cancels a booking owned by the caller's studio", async () => {
    const classTypeId = (await repos.classTypes.listByStudio(studioId))[0].id;
    const memberId = (await repos.members.listByStudio(studioId))[0].id;
    await repos.classSessions.insert({
      id: "own-session",
      studioId,
      classTypeId,
      instructor: "I",
      startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString(),
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    await repos.bookings.insert({
      id: "own-booking",
      sessionId: "own-session",
      memberId,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    const res = await bookingDelete(req(), ctxOf("own-booking"));
    expect(res.status).toBe(200);
    expect((await repos.bookings.getById("own-booking"))?.status).toBe("cancelled");
  });

  it("DELETE /api/bookings/:id 404s (and does not cancel) a booking owned by another studio", async () => {
    const { foreignBookingId } = await seedForeignRecords(repos, studioId);
    const res = await bookingDelete(req(), ctxOf(foreignBookingId));
    expect(res.status).toBe(404);
    expect((await repos.bookings.getById(foreignBookingId))?.status).toBe("booked");
  });
});
