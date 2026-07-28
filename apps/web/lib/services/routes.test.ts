import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoiceDetailGet } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as memberDetailGet } from "@/app/api/members/[id]/route";
import { DELETE as bookingDetailDelete } from "@/app/api/bookings/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Repositories } from "@/lib/db/repos/types";

// The booking detail DELETE calls requireSession(); in a unit test there is no
// request scope for next/headers cookies(), so stub the session module.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "tester@example.com" }),
  SESSION_COOKIE: "studiobook_session",
}));

const NOW = new Date("2026-03-15T12:00:00.000Z");
const ISO = NOW.toISOString();
// canCancel compares against the real clock (`new Date()` inside the service),
// so any session we cancel must be genuinely in the future relative to now.
const REAL_FUTURE = new Date(Date.now() + 7 * 86_400_000).toISOString();
const REAL_FUTURE_END = new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString();

function param(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET route handlers (against injected fake repositories)", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
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

describe("detail route ownership (IDOR) guards", () => {
  let repos: Repositories;
  let studioId: string;
  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    __setTestRepositories(repos);
    studioId = (await repos.studios.getFirst())?.id ?? "";
    process.env.USE_FAKE_BACKENDS = "1";
  });
  afterEach(() => {
    __setTestRepositories(null);
    delete process.env.USE_FAKE_BACKENDS;
  });

  it("GET /api/invoices/[id] 404s for a foreign-studio invoice, 200 for own", async () => {
    const ownInvoice = (await repos.invoices.listByStudio(studioId))[0];
    const own = await invoiceDetailGet(
      new NextRequest(`http://localhost/api/invoices/${ownInvoice.id}`),
      param(ownInvoice.id),
    );
    expect(own.status).toBe(200);

    const foreignMember = await repos.members.insert({
      id: "m-foreign-inv",
      studioId: "s2",
      name: "Other",
      email: "other-inv@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    });
    const foreign = await repos.invoices.insert({
      id: "inv-foreign",
      studioId: "s2",
      memberId: foreignMember.id,
      number: "INV-FOREIGN",
      status: "open",
      currency: "EUR",
      taxRateBps: 900,
      subtotalCents: 1000,
      taxCents: 90,
      totalCents: 1090,
      issuedAt: ISO,
      dueAt: null,
      paidAt: null,
      createdAt: ISO,
    });
    const res = await invoiceDetailGet(
      new NextRequest(`http://localhost/api/invoices/${foreign.id}`),
      param(foreign.id),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
    // Foreign row is untouched.
    expect((await repos.invoices.getById(foreign.id))?.status).toBe("open");
  });

  it("GET /api/members/[id] 404s for a foreign-studio member, 200 for own", async () => {
    const ownMember = (await repos.members.listByStudio(studioId))[0];
    const own = await memberDetailGet(
      new NextRequest(`http://localhost/api/members/${ownMember.id}`),
      param(ownMember.id),
    );
    expect(own.status).toBe(200);

    const foreign = await repos.members.insert({
      id: "m-foreign",
      studioId: "s2",
      name: "Other",
      email: "other@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    });
    const res = await memberDetailGet(
      new NextRequest(`http://localhost/api/members/${foreign.id}`),
      param(foreign.id),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  it("DELETE /api/bookings/[id] 404s for a foreign-studio booking and leaves it uncancelled", async () => {
    const foreignSession = await repos.classSessions.insert({
      id: "cs-foreign",
      studioId: "s2",
      classTypeId: (await repos.classTypes.getById(
        (await repos.classSessions.listByStudio(studioId))[0].classTypeId,
      ))!.id,
      instructor: "I",
      startsAt: REAL_FUTURE,
      endsAt: REAL_FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: ISO,
    });
    const foreignMember = await repos.members.insert({
      id: "m-foreign-bk",
      studioId: "s2",
      name: "Other",
      email: "other-bk@example.com",
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    });
    const foreign = await repos.bookings.insert({
      id: "b-foreign",
      sessionId: foreignSession.id,
      memberId: foreignMember.id,
      status: "booked",
      bookedAt: ISO,
      cancelledAt: null,
    });

    const res = await bookingDetailDelete(
      new NextRequest(`http://localhost/api/bookings/${foreign.id}`, { method: "DELETE" }),
      param(foreign.id),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
    const after = await repos.bookings.getById(foreign.id);
    expect(after?.status).toBe("booked");
    expect(after?.cancelledAt).toBeNull();
  });

  it("DELETE /api/bookings/[id] cancels an own-studio booking", async () => {
    const classType = (await repos.classTypes.listByStudio(studioId))[0];
    const ownSession = await repos.classSessions.insert({
      id: "cs-own",
      studioId,
      classTypeId: classType.id,
      instructor: "I",
      startsAt: REAL_FUTURE,
      endsAt: REAL_FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: ISO,
    });
    const ownMember = (await repos.members.listByStudio(studioId)).find((m) => m.status === "active");
    const own = await repos.bookings.insert({
      id: "b-own",
      sessionId: ownSession.id,
      memberId: ownMember!.id,
      status: "booked",
      bookedAt: ISO,
      cancelledAt: null,
    });
    const res = await bookingDetailDelete(
      new NextRequest(`http://localhost/api/bookings/${own.id}`, { method: "DELETE" }),
      param(own.id),
    );
    expect(res.status).toBe(200);
    expect((await repos.bookings.getById(own.id))?.status).toBe("cancelled");
  });
});
