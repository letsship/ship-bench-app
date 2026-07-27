import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { createFakeProvider } from "@/lib/notifications/fake-provider";

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "test@example.com" }),
}));
vi.mock("@/lib/notifications/provider", () => ({
  createNotificationProvider: () => createFakeProvider(),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

function paramsOf(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
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

describe("by-id route handlers scope to the caller's studio", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id returns 200 for the caller's own invoice, 404 for another studio's", async () => {
    const ownStudio = await repos.studios.getFirst();
    const ownInvoice = (await repos.invoices.listByStudio(ownStudio?.id ?? ""))[0];

    const foreignMember = await repos.members.insert({
      id: "foreign-member-invoice",
      studioId: "other-studio",
      name: "Foreign",
      email: "foreign@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });
    const foreignInvoice = await repos.invoices.insert({
      id: "foreign-invoice",
      studioId: "other-studio",
      memberId: foreignMember.id,
      number: "OTHER-0001",
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

    const ownRes = await invoiceDetailGet(new Request("http://localhost"), paramsOf(ownInvoice.id));
    expect(ownRes.status).toBe(200);

    const foreignRes = await invoiceDetailGet(
      new Request("http://localhost"),
      paramsOf(foreignInvoice.id),
    );
    expect(foreignRes.status).toBe(404);
  });

  it("GET /api/members/:id returns 200 for the caller's own member, 404 for another studio's", async () => {
    const ownStudio = await repos.studios.getFirst();
    const ownMember = (await repos.members.listByStudio(ownStudio?.id ?? ""))[0];

    const foreignMember = await repos.members.insert({
      id: "foreign-member-detail",
      studioId: "other-studio",
      name: "Foreign",
      email: "foreign2@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });

    const ownRes = await memberDetailGet(new Request("http://localhost"), paramsOf(ownMember.id));
    expect(ownRes.status).toBe(200);

    const foreignRes = await memberDetailGet(
      new Request("http://localhost"),
      paramsOf(foreignMember.id),
    );
    expect(foreignRes.status).toBe(404);
  });

  it("DELETE /api/bookings/:id cancels the caller's own booking but 404s (and leaves untouched) another studio's", async () => {
    // Cancellation rules compare against the real wall clock (not the fixed
    // NOW used for seeding), so these sessions must be genuinely in the future.
    const realFuture = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const realFutureEnd = new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString();

    const ownStudio = await repos.studios.getFirst();
    const ownMember = (await repos.members.listByStudio(ownStudio?.id ?? ""))[0];
    const ownClassType = (await repos.classTypes.listByStudio(ownStudio?.id ?? ""))[0];
    const ownSession = await repos.classSessions.insert({
      id: "own-session",
      studioId: ownStudio?.id ?? "",
      classTypeId: ownClassType.id,
      instructor: "Own Instructor",
      startsAt: realFuture,
      endsAt: realFutureEnd,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const ownBooking = await repos.bookings.insert({
      id: "own-booking",
      sessionId: ownSession.id,
      memberId: ownMember.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });

    const foreignSession = await repos.classSessions.insert({
      id: "foreign-session",
      studioId: "other-studio",
      classTypeId: ownSession.classTypeId,
      instructor: "Foreign Instructor",
      startsAt: realFuture,
      endsAt: realFutureEnd,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const foreignMember = await repos.members.insert({
      id: "foreign-member-booking",
      studioId: "other-studio",
      name: "Foreign",
      email: "foreign3@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });
    const foreignBooking = await repos.bookings.insert({
      id: "foreign-booking",
      sessionId: foreignSession.id,
      memberId: foreignMember.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });

    const ownRes = await bookingDelete(new Request("http://localhost"), paramsOf(ownBooking.id));
    expect(ownRes.status).toBe(200);

    const foreignRes = await bookingDelete(
      new Request("http://localhost"),
      paramsOf(foreignBooking.id),
    );
    expect(foreignRes.status).toBe(404);
    expect((await repos.bookings.getById(foreignBooking.id))?.status).toBe("booked");
  });
});
