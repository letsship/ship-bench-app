import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoiceGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { createSessionToken } from "@/lib/auth/session";
import { __setTestRepositories } from "@/lib/db/repos";
import { type Repositories } from "@/lib/db/repos/types";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

const authState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "studiobook_session" && authState.token ? { value: authState.token } : undefined,
  }),
}));

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

describe("detail route handlers scope by studio (cross-tenant IDOR)", () => {
  let repos: Repositories;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    authState.token = await createSessionToken("owner@example.com");
    // cancelBooking() sends a cancellation email; use the in-memory provider
    // instead of requiring a real RESEND_API_KEY in tests.
    process.env.USE_FAKE_BACKENDS = "1";
  });
  afterEach(() => {
    __setTestRepositories(null);
    authState.token = null;
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("GET /api/invoices/:id 404s for another studio's invoice", async () => {
    const foreign = await repos.invoices.insert({
      id: "foreign-invoice",
      studioId: "other-studio",
      memberId: "m-foreign",
      number: "FOREIGN-0001",
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
    const res = await invoiceGet(new NextRequest("http://localhost/api/invoices/x"), {
      params: Promise.resolve({ id: foreign.id }),
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("GET /api/invoices/:id returns 200 for the caller's own invoice", async () => {
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const [own] = await repos.invoices.listByStudio(studioId);
    const res = await invoiceGet(new NextRequest("http://localhost/api/invoices/x"), {
      params: Promise.resolve({ id: own.id }),
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/members/:id 404s for another studio's member", async () => {
    const foreign = await repos.members.insert({
      id: "foreign-member",
      studioId: "other-studio",
      name: "Foreign Member",
      email: "foreign@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });
    const res = await memberGet(new NextRequest("http://localhost/api/members/x"), {
      params: Promise.resolve({ id: foreign.id }),
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("GET /api/members/:id returns 200 for the caller's own member", async () => {
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const [own] = await repos.members.listByStudio(studioId);
    const res = await memberGet(new NextRequest("http://localhost/api/members/x"), {
      params: Promise.resolve({ id: own.id }),
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s and does not cancel another studio's booking", async () => {
    const foreignSession = await repos.classSessions.insert({
      id: "foreign-session",
      studioId: "other-studio",
      classTypeId: "ct-foreign",
      instructor: "Foreign",
      startsAt: new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
      endsAt: new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString(),
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const foreignBooking = await repos.bookings.insert({
      id: "foreign-booking",
      sessionId: foreignSession.id,
      memberId: "m-foreign",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    const res = await bookingDelete(new NextRequest("http://localhost/api/bookings/x"), {
      params: Promise.resolve({ id: foreignBooking.id }),
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
    expect((await repos.bookings.getById(foreignBooking.id))?.status).toBe("booked");
  });

  it("DELETE /api/bookings/:id cancels the caller's own booking", async () => {
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    // canCancel() compares against the real clock, so the session must be
    // genuinely in the future — the fixed seed `NOW` is itself in the past.
    const futureSession = await repos.classSessions.insert({
      id: "own-future-session",
      studioId,
      classTypeId: "ct-own",
      instructor: "Own",
      startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString(),
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const ownBooking = await repos.bookings.insert({
      id: "own-booking",
      sessionId: futureSession.id,
      memberId: (await repos.members.listByStudio(studioId))[0].id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    const res = await bookingDelete(new NextRequest("http://localhost/api/bookings/x"), {
      params: Promise.resolve({ id: ownBooking.id }),
    });
    expect(res.status).toBe(200);
    expect((await repos.bookings.getById(ownBooking.id))?.status).toBe("cancelled");
  });
});
