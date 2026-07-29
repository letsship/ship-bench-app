import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, Invoice, Member } from "@/lib/db/types";

// The booking DELETE handler calls requireSession(), which reads the request
// cookie store via next/headers — unavailable when a route handler is invoked
// directly. Stub it so the handler proceeds to the ownership check under test.
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "studiobook_session",
  createSessionToken: async () => "token",
  requireSession: async () => ({ email: "op@example.com" }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
// The booking cancellation rules compare against the real clock (`new Date()`
// inside the services), so a session we want to cancel must be genuinely in
// the future at test-run time — independent of the fixed seed `NOW` above.
const DAY_MS = 86_400_000;
const FUTURE = new Date(Date.now() + 7 * DAY_MS).toISOString();
const FUTURE_END = new Date(Date.now() + 7 * DAY_MS + 3_600_000).toISOString();

function expectEnvelope(res: Response, status: number, code: string): Promise<void> {
  expect(res.status).toBe(status);
  return res.json().then((body) => {
    expect(body).toMatchObject({ error: { code } });
  });
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

describe("detail route handlers scope by the caller's studio (IDOR guard)", () => {
  let repos: Repositories;
  let studioId: string;
  let ownClassTypeId: string;
  let ownMemberId: string;
  let priorFakeBackends: string | undefined;

  beforeEach(async () => {
    // The booking DELETE route builds its notification provider via
    // createNotificationProvider(); route it at the in-memory recorder so no
    // RESEND_API_KEY is required and dispatch is observable.
    priorFakeBackends = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
    ownClassTypeId = (await repos.classTypes.listByStudio(studioId))[0].id;
    ownMemberId = (await repos.members.listByStudio(studioId))[0].id;
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
    if (priorFakeBackends === undefined) {
      delete process.env.USE_FAKE_BACKENDS;
    } else {
      process.env.USE_FAKE_BACKENDS = priorFakeBackends;
    }
  });

  async function insertForeignInvoice(): Promise<string> {
    const foreignMember: Member = {
      id: "m-finv",
      studioId: "s2",
      name: "Foreign",
      email: "foreign-inv@e.co",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    };
    await repos.members.insert(foreignMember);
    const foreignInvoice: Invoice = {
      id: "inv-foreign",
      studioId: "s2",
      memberId: foreignMember.id,
      number: "INV-FOR-0001",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 1000,
      taxCents: 90,
      totalCents: 1090,
      issuedAt: ISO,
      dueAt: FUTURE,
      paidAt: null,
      createdAt: ISO,
    };
    await repos.invoices.insert(foreignInvoice);
    return foreignInvoice.id;
  }

  async function insertForeignMember(): Promise<string> {
    const foreignMember: Member = {
      id: "m-fmem",
      studioId: "s2",
      name: "Foreign Mem",
      email: "foreign-mem@e.co",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    };
    await repos.members.insert(foreignMember);
    return foreignMember.id;
  }

  async function insertForeignBooking(): Promise<string> {
    const foreignSession: ClassSession = {
      id: "cs-fbook",
      studioId: "s2",
      classTypeId: ownClassTypeId,
      instructor: "I",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: ISO,
    };
    await repos.classSessions.insert(foreignSession);
    const foreignBooking: Booking = {
      id: "b-foreign",
      sessionId: foreignSession.id,
      memberId: ownMemberId,
      status: "booked",
      bookedAt: ISO,
      cancelledAt: null,
    };
    await repos.bookings.insert(foreignBooking);
    return foreignBooking.id;
  }

  async function insertOwnBooking(): Promise<string> {
    const ownSession: ClassSession = {
      id: "cs-own",
      studioId,
      classTypeId: ownClassTypeId,
      instructor: "I",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: ISO,
    };
    await repos.classSessions.insert(ownSession);
    const ownBooking: Booking = {
      id: "b-own",
      sessionId: ownSession.id,
      memberId: ownMemberId,
      status: "booked",
      bookedAt: ISO,
      cancelledAt: null,
    };
    await repos.bookings.insert(ownBooking);
    return ownBooking.id;
  }

  it("GET /api/invoices/:id 404s for a foreign-studio invoice", async () => {
    const foreignId = await insertForeignInvoice();
    const res = await invoiceDetailGet(
      new NextRequest(`http://localhost/api/invoices/${foreignId}`),
      { params: Promise.resolve({ id: foreignId }) },
    );
    await expectEnvelope(res, 404, "not_found");
  });

  it("GET /api/invoices/:id returns 200 for an own-studio invoice", async () => {
    const ownId = (await repos.invoices.listByStudio(studioId))[0].id;
    const res = await invoiceDetailGet(
      new NextRequest(`http://localhost/api/invoices/${ownId}`),
      { params: Promise.resolve({ id: ownId }) },
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/members/:id 404s for a foreign-studio member", async () => {
    const foreignId = await insertForeignMember();
    const res = await memberDetailGet(
      new NextRequest(`http://localhost/api/members/${foreignId}`),
      { params: Promise.resolve({ id: foreignId }) },
    );
    await expectEnvelope(res, 404, "not_found");
  });

  it("GET /api/members/:id returns 200 for an own-studio member", async () => {
    const res = await memberDetailGet(
      new NextRequest(`http://localhost/api/members/${ownMemberId}`),
      { params: Promise.resolve({ id: ownMemberId }) },
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s and does not cancel a foreign booking", async () => {
    const foreignId = await insertForeignBooking();
    const res = await bookingDelete(
      new NextRequest(`http://localhost/api/bookings/${foreignId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: foreignId }) },
    );
    await expectEnvelope(res, 404, "not_found");
    expect((await repos.bookings.getById(foreignId))?.status).toBe("booked");
  });

  it("DELETE /api/bookings/:id cancels an own-studio booking", async () => {
    const ownId = await insertOwnBooking();
    const res = await bookingDelete(
      new NextRequest(`http://localhost/api/bookings/${ownId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ownId }) },
    );
    expect(res.status).toBe(200);
    expect((await repos.bookings.getById(ownId))?.status).toBe("cancelled");
  });
});
