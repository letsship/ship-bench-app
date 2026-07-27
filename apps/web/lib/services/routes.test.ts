import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoiceGet, PATCH as invoicePatch } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { createFakeProvider } from "@/lib/notifications/fake-provider";

vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn(async () => ({ email: "a@b.co" })) }));
vi.mock("@/lib/notifications/provider", () => ({
  createNotificationProvider: () => createFakeProvider(),
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");

function routeParams(id: string): { params: Promise<{ id: string }> } {
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

describe("[id] route handlers are scoped to the caller's studio", () => {
  const FOREIGN_STUDIO_ID = "other-studio";
  // The booking rules compare against the real clock (`new Date()` inside the
  // service), so this fixture must be genuinely in the future regardless of
  // the fixed `NOW` used for the rest of the seeded calendar.
  const REAL_FUTURE_START = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const REAL_FUTURE_END = new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString();

  function seedWithForeignRows(): SeedData {
    const seed = buildSeed(NOW);
    return {
      ...seed,
      members: [
        ...seed.members,
        {
          id: "foreign-member",
          studioId: FOREIGN_STUDIO_ID,
          name: "Foreign Member",
          email: "foreign@example.com",
          phone: null,
          status: "active",
          notificationsOptedOut: false,
          createdAt: NOW.toISOString(),
        },
      ],
      invoices: [
        ...seed.invoices,
        {
          id: "foreign-invoice",
          studioId: FOREIGN_STUDIO_ID,
          memberId: "foreign-member",
          number: "F-0001",
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
        },
      ],
      sessions: [
        ...seed.sessions,
        {
          id: "foreign-session",
          studioId: FOREIGN_STUDIO_ID,
          classTypeId: seed.classTypes[0].id,
          instructor: "Someone",
          startsAt: REAL_FUTURE_START,
          endsAt: REAL_FUTURE_END,
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: NOW.toISOString(),
        },
        {
          id: "own-session",
          studioId: seed.studio.id,
          classTypeId: seed.classTypes[0].id,
          instructor: "Someone",
          startsAt: REAL_FUTURE_START,
          endsAt: REAL_FUTURE_END,
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: NOW.toISOString(),
        },
      ],
      bookings: [
        ...seed.bookings,
        {
          id: "foreign-booking",
          sessionId: "foreign-session",
          memberId: "foreign-member",
          status: "booked",
          bookedAt: NOW.toISOString(),
          cancelledAt: null,
        },
        {
          id: "own-booking",
          sessionId: "own-session",
          memberId: seed.members[0].id,
          status: "booked",
          bookedAt: NOW.toISOString(),
          cancelledAt: null,
        },
      ],
    };
  }

  let repos: ReturnType<typeof createInMemoryRepositories>;
  beforeEach(() => {
    repos = createInMemoryRepositories(seedWithForeignRows());
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id 404s for another studio's invoice", async () => {
    const res = await invoiceGet(
      new NextRequest("http://localhost/api/invoices/foreign-invoice"),
      routeParams("foreign-invoice"),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("GET /api/invoices/:id returns the caller's own invoice", async () => {
    const list = (await (await invoicesGet()).json()) as { id: string }[];
    const ownId = list[0].id;
    const res = await invoiceGet(
      new NextRequest(`http://localhost/api/invoices/${ownId}`),
      routeParams(ownId),
    );
    expect(res.status).toBe(200);
  });

  it("PATCH /api/invoices/:id 404s for another studio's invoice and leaves it unmodified", async () => {
    const res = await invoicePatch(
      new NextRequest("http://localhost/api/invoices/foreign-invoice", {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      routeParams("foreign-invoice"),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
    expect((await repos.invoices.getById("foreign-invoice"))?.status).toBe("open");
  });

  it("PATCH /api/invoices/:id updates the caller's own invoice", async () => {
    const list = (await (await invoicesGet()).json()) as { id: string; status: string }[];
    const ownId = list.find((invoice) => invoice.status === "open")?.id;
    if (!ownId) throw new Error("expected a seeded invoice with status 'open'");
    const res = await invoicePatch(
      new NextRequest(`http://localhost/api/invoices/${ownId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      routeParams(ownId),
    );
    expect(res.status).toBe(200);
    expect((await repos.invoices.getById(ownId))?.status).toBe("paid");
  });

  it("GET /api/members/:id 404s for another studio's member", async () => {
    const res = await memberGet(
      new NextRequest("http://localhost/api/members/foreign-member"),
      routeParams("foreign-member"),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("GET /api/members/:id returns the caller's own member", async () => {
    const list = (await (await membersGet()).json()) as { id: string }[];
    const ownId = list[0].id;
    const res = await memberGet(
      new NextRequest(`http://localhost/api/members/${ownId}`),
      routeParams(ownId),
    );
    expect(res.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for another studio's booking and leaves it uncancelled", async () => {
    const res = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/foreign-booking", { method: "DELETE" }),
      routeParams("foreign-booking"),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
    const untouched = await repos.bookings.getById("foreign-booking");
    expect(untouched?.status).toBe("booked");
    expect(untouched?.cancelledAt).toBeNull();
  });

  it("DELETE /api/bookings/:id cancels the caller's own booking", async () => {
    const res = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/own-booking", { method: "DELETE" }),
      routeParams("own-booking"),
    );
    expect(res.status).toBe(200);
    const cancelled = await repos.bookings.getById("own-booking");
    expect(cancelled?.status).toBe("cancelled");
  });
});
