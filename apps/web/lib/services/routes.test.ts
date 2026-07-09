import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingsIdDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoicesIdGet, PATCH as invoicesIdPatch } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as membersIdGet, PATCH as membersIdPatch } from "@/app/api/members/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import type { Repositories } from "@/lib/db/repos/types";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: async () => ({ email: "test@example.com" }) };
});

const NOW = new Date("2026-03-15T12:00:00.000Z");
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

describe("id-scoped route handlers reject records from another studio", () => {
  let repos: Repositories;
  let ownInvoiceId: string;
  let ownMemberId: string;
  let ownBookingId: string;
  let previousUseFakeBackends: string | undefined;

  beforeEach(async () => {
    previousUseFakeBackends = process.env.USE_FAKE_BACKENDS;
    process.env.USE_FAKE_BACKENDS = "1";
    const seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);

    ownInvoiceId =
      seed.invoices.find((invoice) => invoice.status === "open")?.id ?? seed.invoices[0].id;
    ownMemberId = seed.members[0].id;

    await repos.invoices.insert({
      ...seed.invoices[0],
      id: "foreign-invoice",
      studioId: "s2",
    });
    await repos.members.insert({
      ...seed.members[0],
      id: "foreign-member",
      studioId: "s2",
      email: "foreign@example.com",
    });

    const ownSession = await repos.classSessions.insert({
      id: "own-session",
      studioId: seed.studio.id,
      classTypeId: seed.classTypes[0].id,
      instructor: "Test",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const ownBooking = await repos.bookings.insert({
      id: "own-booking",
      sessionId: ownSession.id,
      memberId: ownMemberId,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
    ownBookingId = ownBooking.id;

    const foreignSession = await repos.classSessions.insert({
      id: "foreign-session",
      studioId: "s2",
      classTypeId: seed.classTypes[0].id,
      instructor: "Test",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    await repos.bookings.insert({
      id: "foreign-booking",
      sessionId: foreignSession.id,
      memberId: "foreign-member",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
  });

  afterEach(() => {
    __setTestRepositories(null);
    process.env.USE_FAKE_BACKENDS = previousUseFakeBackends;
  });

  it("GET/PATCH /api/invoices/:id 404 for a foreign invoice and succeed for the caller's own", async () => {
    const foreignGet = await invoicesIdGet(
      new NextRequest("http://localhost/api/invoices/foreign-invoice"),
      {
        params: Promise.resolve({ id: "foreign-invoice" }),
      },
    );
    expect(foreignGet.status).toBe(404);

    const foreignPatch = await invoicesIdPatch(
      new NextRequest("http://localhost/api/invoices/foreign-invoice", {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      { params: Promise.resolve({ id: "foreign-invoice" }) },
    );
    expect(foreignPatch.status).toBe(404);

    const ownGet = await invoicesIdGet(
      new NextRequest(`http://localhost/api/invoices/${ownInvoiceId}`),
      {
        params: Promise.resolve({ id: ownInvoiceId }),
      },
    );
    expect(ownGet.status).toBe(200);

    const ownPatch = await invoicesIdPatch(
      new NextRequest(`http://localhost/api/invoices/${ownInvoiceId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      { params: Promise.resolve({ id: ownInvoiceId }) },
    );
    expect(ownPatch.status).toBe(200);
  });

  it("GET/PATCH /api/members/:id 404 for a foreign member and succeed for the caller's own", async () => {
    const foreignGet = await membersIdGet(
      new NextRequest("http://localhost/api/members/foreign-member"),
      {
        params: Promise.resolve({ id: "foreign-member" }),
      },
    );
    expect(foreignGet.status).toBe(404);

    const foreignPatch = await membersIdPatch(
      new NextRequest("http://localhost/api/members/foreign-member", {
        method: "PATCH",
        body: JSON.stringify({ status: "paused" }),
      }),
      { params: Promise.resolve({ id: "foreign-member" }) },
    );
    expect(foreignPatch.status).toBe(404);

    const ownGet = await membersIdGet(
      new NextRequest(`http://localhost/api/members/${ownMemberId}`),
      {
        params: Promise.resolve({ id: ownMemberId }),
      },
    );
    expect(ownGet.status).toBe(200);

    const ownPatch = await membersIdPatch(
      new NextRequest(`http://localhost/api/members/${ownMemberId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paused" }),
      }),
      { params: Promise.resolve({ id: ownMemberId }) },
    );
    expect(ownPatch.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for a foreign booking and cancels the caller's own", async () => {
    const foreignDelete = await bookingsIdDelete(
      new NextRequest("http://localhost/api/bookings/foreign-booking", { method: "DELETE" }),
      { params: Promise.resolve({ id: "foreign-booking" }) },
    );
    expect(foreignDelete.status).toBe(404);
    expect((await repos.bookings.getById("foreign-booking"))?.status).toBe("booked");

    const ownDelete = await bookingsIdDelete(
      new NextRequest(`http://localhost/api/bookings/${ownBookingId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ownBookingId }) },
    );
    expect(ownDelete.status).toBe(200);
    expect((await repos.bookings.getById(ownBookingId))?.status).toBe("cancelled");
  });
});
