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
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "operator@example.com" }),
}));

vi.mock("@/lib/notifications/provider", () => ({
  createNotificationProvider: () => ({
    name: "fake",
    send: async () => ({ providerMessageId: "fake-route-test" }),
  }),
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

  it("scopes invoice detail requests to the caller's studio", async () => {
    const seed = buildSeed(NOW);
    const foreignInvoice = { ...seed.invoices[0], id: "foreign-invoice", studioId: "s2" };
    const repos = createInMemoryRepositories({ ...seed, invoices: [...seed.invoices, foreignInvoice] });
    __setTestRepositories(repos);

    const foreign = await invoiceDetailGet(
      new NextRequest("http://localhost/api/invoices/foreign-invoice"),
      { params: Promise.resolve({ id: foreignInvoice.id }) },
    );
    const own = await invoiceDetailGet(new NextRequest("http://localhost/api/invoices/own"), {
      params: Promise.resolve({ id: seed.invoices[0].id }),
    });

    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toMatchObject({ error: { code: "not_found" } });
    expect(own.status).toBe(200);
  });

  it("scopes member detail requests to the caller's studio", async () => {
    const seed = buildSeed(NOW);
    const foreignMember = { ...seed.members[0], id: "foreign-member", studioId: "s2" };
    const repos = createInMemoryRepositories({ ...seed, members: [...seed.members, foreignMember] });
    __setTestRepositories(repos);

    const foreign = await memberDetailGet(
      new NextRequest("http://localhost/api/members/foreign-member"),
      { params: Promise.resolve({ id: foreignMember.id }) },
    );
    const own = await memberDetailGet(new NextRequest("http://localhost/api/members/own"), {
      params: Promise.resolve({ id: seed.members[0].id }),
    });

    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toMatchObject({ error: { code: "not_found" } });
    expect(own.status).toBe(200);
  });

  it("rejects foreign booking cancellations without mutation", async () => {
    const seed = buildSeed(NOW);
    const startsAt = "2027-03-15T12:00:00.000Z";
    const endsAt = "2027-03-15T13:00:00.000Z";
    const ownSession = {
      ...seed.sessions[0],
      id: "own-session",
      startsAt,
      endsAt,
    };
    const foreignSession = { ...ownSession, id: "foreign-session", studioId: "s2" };
    const ownBooking = {
      id: "own-booking",
      sessionId: ownSession.id,
      memberId: seed.members[0].id,
      status: "booked",
      bookedAt: startsAt,
      cancelledAt: null,
    };
    const foreignMember = { ...seed.members[0], id: "foreign-booking-member", studioId: "s2" };
    const foreignBooking = {
      ...ownBooking,
      id: "foreign-booking",
      sessionId: foreignSession.id,
      memberId: foreignMember.id,
    };
    const repos = createInMemoryRepositories({
      ...seed,
      members: [...seed.members, foreignMember],
      sessions: [...seed.sessions, ownSession, foreignSession],
      bookings: [...seed.bookings, ownBooking, foreignBooking],
    });
    __setTestRepositories(repos);

    const foreign = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/foreign-booking", { method: "DELETE" }),
      { params: Promise.resolve({ id: foreignBooking.id }) },
    );
    const own = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/own-booking", { method: "DELETE" }),
      { params: Promise.resolve({ id: ownBooking.id }) },
    );

    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toMatchObject({ error: { code: "not_found" } });
    expect((await repos.bookings.getById(foreignBooking.id))?.status).toBe("booked");
    expect(own.status).toBe(200);
    expect((await repos.bookings.getById(ownBooking.id))?.status).toBe("cancelled");
  });
});
