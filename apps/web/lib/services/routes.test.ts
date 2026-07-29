import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, Invoice, Member } from "@/lib/db/types";

// The [id] DELETE handler calls requireSession(); in the node test env there is
// no Next request scope to read cookies from, so stub the session check.
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ email: "owner@example.com" })),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");
const FOREIGN_STUDIO = "s-other";

// Build a repos that seeds, alongside the caller's own studio records, a second
// studio's invoice/member/booking so the [id] handlers can be asserted against
// cross-tenant ids.
function buildScopingReposFromBase(base: SeedData): Repositories {
  const ownStudioId = base.studio.id;
  const nowIso = NOW.toISOString();
  // cancelBooking compares startsAt against the real clock, so pick a session
  // that is genuinely in the future relative to Date.now() (not the fixed NOW).
  const futureSession = base.sessions.find(
    (session) => new Date(session.startsAt).getTime() > Date.now() + 86_400_000,
  )!;
  const ownBooker: Member = {
    id: "m-own-booking",
    studioId: ownStudioId,
    name: "Own Booker",
    email: "own-booker@own.co",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: nowIso,
  };
  const foreignMember: Member = {
    id: "m-foreign",
    studioId: FOREIGN_STUDIO,
    name: "Foreign",
    email: "foreign@other.co",
    phone: null,
    status: "active",
    notificationsOptedOut: false,
    createdAt: nowIso,
  };
  const foreignInvoice: Invoice = {
    id: "inv-foreign",
    studioId: FOREIGN_STUDIO,
    memberId: "m-foreign",
    number: "INV-F-1",
    status: "open",
    currency: "EUR",
    taxRateBps: 900,
    subtotalCents: 1000,
    taxCents: 90,
    totalCents: 1090,
    issuedAt: nowIso,
    dueAt: null,
    paidAt: null,
    createdAt: nowIso,
  };
  const foreignSession: ClassSession = {
    id: "cs-foreign",
    studioId: FOREIGN_STUDIO,
    classTypeId: base.classTypes[0].id,
    instructor: "I",
    startsAt: futureSession.startsAt,
    endsAt: futureSession.endsAt,
    capacity: 10,
    priceCents: 1000,
    status: "scheduled",
    createdAt: nowIso,
  };
  const ownBooking: Booking = {
    id: "b-own",
    sessionId: futureSession.id,
    memberId: "m-own-booking",
    status: "booked",
    bookedAt: nowIso,
    cancelledAt: null,
  };
  const foreignBooking: Booking = {
    id: "b-foreign",
    sessionId: "cs-foreign",
    memberId: "m-foreign",
    status: "booked",
    bookedAt: nowIso,
    cancelledAt: null,
  };
  return createInMemoryRepositories({
    ...base,
    members: [...base.members, ownBooker, foreignMember],
    invoices: [...base.invoices, foreignInvoice],
    sessions: [...base.sessions, foreignSession],
    bookings: [...base.bookings, ownBooking, foreignBooking],
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

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

describe("detail route tenant scoping (IDOR)", () => {
  let repos: Repositories;
  let ownInvoiceId: string;
  let ownMemberId: string;
  let prevFakeBackends: string | undefined;

  beforeEach(() => {
    // Seed around the real clock so future sessions exist for the cancellation
    // path (cancelBooking compares startsAt to Date.now()).
    const base = buildSeed(new Date());
    ownInvoiceId = base.invoices[0].id;
    ownMemberId = base.members[0].id;
    repos = buildScopingReposFromBase(base);
    // createNotificationProvider() (used by the DELETE handler) needs either a
    // real Resend key or fake-backends mode; use the fake recorder so the route
    // is hermetic. testRepositories still wins for resolveRepositories().
    prevFakeBackends = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
    __setTestRepositories(repos);
  });

  afterEach(() => {
    if (prevFakeBackends === undefined) delete process.env.USE_FAKE_BACKENDS;
    else process.env.USE_FAKE_BACKENDS = prevFakeBackends;
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id 404s for a foreign-studio invoice; own resolves 200", async () => {
    const foreign = await invoiceDetailGet(
      new NextRequest("http://localhost/api/invoices/inv-foreign"),
      params("inv-foreign"),
    );
    expect(foreign.status).toBe(404);
    expect(((await foreign.json()) as { error: { code: string } }).error.code).toBe("not_found");

    const own = await invoiceDetailGet(
      new NextRequest(`http://localhost/api/invoices/${ownInvoiceId}`),
      params(ownInvoiceId),
    );
    expect(own.status).toBe(200);
  });

  it("GET /api/members/:id 404s for a foreign-studio member; own resolves 200", async () => {
    const foreign = await memberDetailGet(
      new NextRequest("http://localhost/api/members/m-foreign"),
      params("m-foreign"),
    );
    expect(foreign.status).toBe(404);
    expect(((await foreign.json()) as { error: { code: string } }).error.code).toBe("not_found");

    const own = await memberDetailGet(
      new NextRequest(`http://localhost/api/members/${ownMemberId}`),
      params(ownMemberId),
    );
    expect(own.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for a foreign-studio booking and leaves it uncancelled", async () => {
    const foreign = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/b-foreign", { method: "DELETE" }),
      params("b-foreign"),
    );
    expect(foreign.status).toBe(404);
    expect(((await foreign.json()) as { error: { code: string } }).error.code).toBe("not_found");

    const unchanged = await repos.bookings.getById("b-foreign");
    expect(unchanged?.status).toBe("booked");
    expect(unchanged?.cancelledAt).toBeNull();
  });

  it("DELETE /api/bookings/:id cancels an own-studio booking (200)", async () => {
    const own = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/b-own", { method: "DELETE" }),
      params("b-own"),
    );
    expect(own.status).toBe(200);
    const cancelled = await repos.bookings.getById("b-own");
    expect(cancelled?.status).toBe("cancelled");
  });
});
