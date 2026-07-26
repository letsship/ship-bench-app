import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingsDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/auth/session");
  return { ...actual, requireSession: vi.fn().mockResolvedValue({ email: "test@example.com" }) };
});

const NOW = new Date("2026-03-15T12:00:00.000Z");
const FOREIGN_STUDIO_ID = "other-studio";

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

describe("detail route handlers enforce studio ownership", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;
  let seed: SeedData;
  let ownBookingId: string;
  const foreignBookingId = "foreign-booking";

  beforeEach(async () => {
    process.env.USE_FAKE_BACKENDS = "1";
    seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);

    await repos.members.insert({
      id: "foreign-member",
      studioId: FOREIGN_STUDIO_ID,
      name: "Foreign Member",
      email: "foreign@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: NOW.toISOString(),
    });

    await repos.invoices.insert({
      id: "foreign-invoice",
      studioId: FOREIGN_STUDIO_ID,
      memberId: "foreign-member",
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

    await repos.classSessions.insert({
      id: "foreign-session",
      studioId: FOREIGN_STUDIO_ID,
      classTypeId: seed.classTypes[0].id,
      instructor: "Foreign Instructor",
      startsAt: new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
      endsAt: new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString(),
      capacity: 5,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });

    await repos.bookings.insert({
      id: foreignBookingId,
      sessionId: "foreign-session",
      memberId: "foreign-member",
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });

    // The cancellation rules compare against the real wall clock (`new
    // Date()`), not the fixed `NOW` used to build the rest of the seed, so
    // this session must be genuinely in the future.
    const future = new Date(Date.now() + 30 * 86_400_000);
    await repos.classSessions.insert({
      id: "own-session",
      studioId: seed.studio.id,
      classTypeId: seed.classTypes[0].id,
      instructor: "Own Instructor",
      startsAt: future.toISOString(),
      endsAt: new Date(future.getTime() + 3_600_000).toISOString(),
      capacity: 5,
      priceCents: 1000,
      status: "scheduled",
      createdAt: NOW.toISOString(),
    });
    ownBookingId = "own-booking";
    await repos.bookings.insert({
      id: ownBookingId,
      sessionId: "own-session",
      memberId: seed.members[0].id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    });
  });

  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("GET /api/invoices/:id 404s for another studio's invoice", async () => {
    const res = await invoiceDetailGet(
      new Request("http://localhost/api/invoices/foreign-invoice"),
      {
        params: Promise.resolve({ id: "foreign-invoice" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/invoices/:id succeeds for the caller's own invoice", async () => {
    const res = await invoiceDetailGet(new Request("http://localhost/api/invoices/own"), {
      params: Promise.resolve({ id: seed.invoices[0].id }),
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/members/:id 404s for another studio's member", async () => {
    const res = await memberDetailGet(new Request("http://localhost/api/members/foreign-member"), {
      params: Promise.resolve({ id: "foreign-member" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id succeeds for the caller's own member", async () => {
    const res = await memberDetailGet(new Request("http://localhost/api/members/own"), {
      params: Promise.resolve({ id: seed.members[0].id }),
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for another studio's booking and leaves it uncancelled", async () => {
    const res = await bookingsDelete(
      new Request("http://localhost/api/bookings/foreign-booking", { method: "DELETE" }),
      { params: Promise.resolve({ id: foreignBookingId }) },
    );
    expect(res.status).toBe(404);
    expect((await repos.bookings.getById(foreignBookingId))?.status).toBe("booked");
  });

  it("DELETE /api/bookings/:id cancels the caller's own booking", async () => {
    const res = await bookingsDelete(
      new Request("http://localhost/api/bookings/own", { method: "DELETE" }),
      { params: Promise.resolve({ id: ownBookingId }) },
    );
    expect(res.status).toBe(200);
    expect((await repos.bookings.getById(ownBookingId))?.status).toBe("cancelled");
  });
});
