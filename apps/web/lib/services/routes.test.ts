import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingsDelete } from "@/app/api/bookings/[id]/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoiceGet, PATCH as invoicePatch } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberGet, PATCH as memberPatch } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, Invoice, Member } from "@/lib/db/types";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

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

describe("cross-studio IDOR regression (detail routes)", () => {
  // cancelBooking checks the cancellation window against the real clock (not
  // the fixed seed `NOW`), so the session must be genuinely in the future.
  const REAL_NOW = Date.now();
  const FUTURE = new Date(REAL_NOW + 7 * 86_400_000).toISOString();
  const FUTURE_END = new Date(REAL_NOW + 7 * 86_400_000 + 3_600_000).toISOString();
  const FOREIGN_STUDIO = "other-studio";

  let studioId: string;
  let sessionToken: string;
  let repos: ReturnType<typeof createInMemoryRepositories>;

  beforeAll(async () => {
    sessionToken = await createSessionToken("owner@example.com");
  });

  beforeEach(async () => {
    process.env.USE_FAKE_BACKENDS = "1";
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === SESSION_COOKIE ? { name, value: sessionToken } : undefined),
    } as never);

    const seed = buildSeed(NOW);
    studioId = seed.studio.id;

    const ownMember: Member = {
      id: "own-member",
      studioId,
      name: "Own Member",
      email: "own-member@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    };
    const foreignMember: Member = {
      ...ownMember,
      id: "foreign-member",
      studioId: FOREIGN_STUDIO,
      email: "foreign-member@example.com",
    };
    const ownSession: ClassSession = {
      id: "own-session",
      studioId,
      classTypeId: seed.classTypes[0].id,
      instructor: "Instructor",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    };
    const foreignSession: ClassSession = {
      ...ownSession,
      id: "foreign-session",
      studioId: FOREIGN_STUDIO,
    };
    const ownBooking: Booking = {
      id: "own-booking",
      sessionId: "own-session",
      memberId: "own-member",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    };
    const foreignBooking: Booking = {
      id: "foreign-booking",
      sessionId: "foreign-session",
      memberId: "foreign-member",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    };
    const ownInvoice: Invoice = {
      id: "own-invoice",
      studioId,
      memberId: "own-member",
      number: "INV-OWN",
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
    const foreignInvoice: Invoice = {
      ...ownInvoice,
      id: "foreign-invoice",
      studioId: FOREIGN_STUDIO,
      memberId: "foreign-member",
      number: "INV-FOREIGN",
    };

    const merged: SeedData = {
      ...seed,
      members: [...seed.members, ownMember, foreignMember],
      sessions: [...seed.sessions, ownSession, foreignSession],
      bookings: [...seed.bookings, ownBooking, foreignBooking],
      invoices: [...seed.invoices, ownInvoice, foreignInvoice],
    };
    repos = createInMemoryRepositories(merged);
    __setTestRepositories(repos);
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
    vi.restoreAllMocks();
  });

  const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
  const patchRequest = (url: string, body: unknown) =>
    new NextRequest(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("GET /api/invoices/:id 404s for a foreign-studio invoice", async () => {
    const res = await invoiceGet(
      new NextRequest("http://localhost/api/invoices/foreign-invoice"),
      paramsFor("foreign-invoice"),
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/invoices/:id succeeds for the caller's own invoice", async () => {
    const res = await invoiceGet(
      new NextRequest("http://localhost/api/invoices/own-invoice"),
      paramsFor("own-invoice"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice: Invoice };
    expect(body.invoice.id).toBe("own-invoice");
  });

  it("PATCH /api/invoices/:id 404s for a foreign-studio invoice and does not modify it", async () => {
    const res = await invoicePatch(
      patchRequest("http://localhost/api/invoices/foreign-invoice", { status: "paid" }),
      paramsFor("foreign-invoice"),
    );
    expect(res.status).toBe(404);
    expect((await repos.invoices.getById("foreign-invoice"))?.status).toBe("open");
  });

  it("PATCH /api/invoices/:id succeeds for the caller's own invoice", async () => {
    const res = await invoicePatch(
      patchRequest("http://localhost/api/invoices/own-invoice", { status: "paid" }),
      paramsFor("own-invoice"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Invoice;
    expect(body.status).toBe("paid");
  });

  it("GET /api/members/:id 404s for a foreign-studio member", async () => {
    const res = await memberGet(
      new NextRequest("http://localhost/api/members/foreign-member"),
      paramsFor("foreign-member"),
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id succeeds for the caller's own member", async () => {
    const res = await memberGet(
      new NextRequest("http://localhost/api/members/own-member"),
      paramsFor("own-member"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Member;
    expect(body.id).toBe("own-member");
  });

  it("PATCH /api/members/:id 404s for a foreign-studio member and does not modify it", async () => {
    const res = await memberPatch(
      patchRequest("http://localhost/api/members/foreign-member", { status: "paused" }),
      paramsFor("foreign-member"),
    );
    expect(res.status).toBe(404);
    expect((await repos.members.getById("foreign-member"))?.status).toBe("active");
  });

  it("PATCH /api/members/:id succeeds for the caller's own member", async () => {
    const res = await memberPatch(
      patchRequest("http://localhost/api/members/own-member", { status: "paused" }),
      paramsFor("own-member"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Member;
    expect(body.status).toBe("paused");
  });

  it("DELETE /api/bookings/:id 404s for a foreign-studio booking and leaves it unmutated", async () => {
    const res = await bookingsDelete(
      new NextRequest("http://localhost/api/bookings/foreign-booking", { method: "DELETE" }),
      paramsFor("foreign-booking"),
    );
    expect(res.status).toBe(404);
    expect((await repos.bookings.getById("foreign-booking"))?.status).toBe("booked");
  });

  it("DELETE /api/bookings/:id cancels the caller's own booking", async () => {
    const res = await bookingsDelete(
      new NextRequest("http://localhost/api/bookings/own-booking", { method: "DELETE" }),
      paramsFor("own-booking"),
    );
    expect(res.status).toBe(200);
  });
});
