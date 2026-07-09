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

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ email: "operator@example.com" }),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");
// The booking cancellation window compares against the real system clock, not
// the fixed seed `NOW`, so the "own studio" session must be genuinely future.
const REAL_NOW = new Date();
const SESSION_FUTURE = new Date(REAL_NOW.getTime() + 7 * 86_400_000).toISOString();
const SESSION_FUTURE_END = new Date(REAL_NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

const paramsFor = (id: string): { params: Promise<{ id: string }> } => ({
  params: Promise.resolve({ id }),
});

describe("GET route handlers (against injected fake repositories)", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    // cancelBooking's route sends a notification; use the in-memory provider
    // rather than requiring a real RESEND_API_KEY in tests.
    process.env.USE_FAKE_BACKENDS = "1";
  });
  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
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

  it("GET /api/invoices/:id 404s for another studio's invoice and 200s for its own", async () => {
    const list = (await (await invoicesGet()).json()) as { id: string }[];
    const ownId = list[0].id;

    const foreignMember = await repos.members.insert({
      id: "foreign-member",
      studioId: "other-studio",
      name: "Foreign Member",
      email: "foreign@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });
    await repos.invoices.insert({
      id: "foreign-invoice",
      studioId: "other-studio",
      memberId: foreignMember.id,
      number: "OTHER-0001",
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

    const foreignRes = await invoiceDetailGet(
      new NextRequest("http://localhost/api/invoices/foreign-invoice"),
      paramsFor("foreign-invoice"),
    );
    expect(foreignRes.status).toBe(404);

    const ownRes = await invoiceDetailGet(
      new NextRequest(`http://localhost/api/invoices/${ownId}`),
      paramsFor(ownId),
    );
    expect(ownRes.status).toBe(200);
  });

  it("GET /api/members/:id 404s for another studio's member and 200s for its own", async () => {
    const list = (await (await membersGet()).json()) as { id: string }[];
    const ownId = list[0].id;

    await repos.members.insert({
      id: "foreign-member-2",
      studioId: "other-studio",
      name: "Foreign Member Two",
      email: "foreign2@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });

    const foreignRes = await memberDetailGet(
      new NextRequest("http://localhost/api/members/foreign-member-2"),
      paramsFor("foreign-member-2"),
    );
    expect(foreignRes.status).toBe(404);

    const ownRes = await memberDetailGet(
      new NextRequest(`http://localhost/api/members/${ownId}`),
      paramsFor(ownId),
    );
    expect(ownRes.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for another studio's booking and cancels its own", async () => {
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const classTypeId = (await repos.classTypes.listByStudio(studioId))[0].id;
    const ownMember = (await repos.members.listByStudio(studioId))[0];

    const ownSession = await repos.classSessions.insert({
      id: "own-session",
      studioId,
      classTypeId,
      instructor: "I",
      startsAt: SESSION_FUTURE,
      endsAt: SESSION_FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    await repos.bookings.insert({
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
      classTypeId,
      instructor: "I",
      startsAt: SESSION_FUTURE,
      endsAt: SESSION_FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    const foreignMember = await repos.members.insert({
      id: "foreign-member-3",
      studioId: "other-studio",
      name: "Foreign Member Three",
      email: "foreign3@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });
    await repos.bookings.insert({
      id: "foreign-booking",
      sessionId: foreignSession.id,
      memberId: foreignMember.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });

    const foreignRes = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/foreign-booking", { method: "DELETE" }),
      paramsFor("foreign-booking"),
    );
    expect(foreignRes.status).toBe(404);
    expect((await repos.bookings.getById("foreign-booking"))?.status).toBe("booked");

    const ownRes = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/own-booking", { method: "DELETE" }),
      paramsFor("own-booking"),
    );
    expect(ownRes.status).toBe(200);
    expect((await repos.bookings.getById("own-booking"))?.status).toBe("cancelled");
  });
});
