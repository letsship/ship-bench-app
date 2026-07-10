import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: vi.fn().mockResolvedValue({ email: "test@example.com" }) };
});

import { GET as classesGet } from "@/app/api/classes/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { GET as invoiceGet, PATCH as invoicePatch } from "@/app/api/invoices/[id]/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Booking, ClassSession, ClassType, Invoice, Member } from "@/lib/db/types";

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

function paramsFor(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("id-based route handlers reject cross-studio access", () => {
  beforeEach(() => {
    // cancelBooking() sends a notification; route to the in-memory fake provider.
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
  });
  afterEach(() => {
    __setTestRepositories(null);
    vi.unstubAllEnvs();
  });

  it("GET /api/invoices/:id 404s for another studio's invoice, and succeeds for the caller's own", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const foreignMember: Member = {
      ...seed.members[0],
      id: "foreign-member",
      studioId: "other-studio",
    };
    await repos.members.insert(foreignMember);
    const foreignInvoice: Invoice = {
      ...seed.invoices[0],
      id: "foreign-invoice",
      studioId: "other-studio",
      memberId: foreignMember.id,
    };
    await repos.invoices.insert(foreignInvoice);
    __setTestRepositories(repos);

    const foreignRes = await invoiceGet(
      new NextRequest("http://localhost/api/invoices/foreign-invoice"),
      paramsFor("foreign-invoice"),
    );
    expect(foreignRes.status).toBe(404);

    const homeRes = await invoiceGet(
      new NextRequest(`http://localhost/api/invoices/${seed.invoices[0].id}`),
      paramsFor(seed.invoices[0].id),
    );
    expect(homeRes.status).toBe(200);
  });

  it("PATCH /api/invoices/:id 404s for another studio's invoice and leaves it unchanged", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const foreignMember: Member = {
      ...seed.members[0],
      id: "foreign-member",
      studioId: "other-studio",
    };
    await repos.members.insert(foreignMember);
    const foreignInvoice: Invoice = {
      ...seed.invoices[0],
      id: "foreign-invoice",
      studioId: "other-studio",
      memberId: foreignMember.id,
      status: "open",
    };
    await repos.invoices.insert(foreignInvoice);
    __setTestRepositories(repos);

    const res = await invoicePatch(
      new NextRequest("http://localhost/api/invoices/foreign-invoice", {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
        headers: { "content-type": "application/json" },
      }),
      paramsFor("foreign-invoice"),
    );
    expect(res.status).toBe(404);
    expect((await repos.invoices.getById("foreign-invoice"))?.status).toBe("open");
  });

  it("GET /api/members/:id 404s for another studio's member, and succeeds for the caller's own", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const foreignMember: Member = {
      ...seed.members[0],
      id: "foreign-member",
      studioId: "other-studio",
    };
    await repos.members.insert(foreignMember);
    __setTestRepositories(repos);

    const foreignRes = await memberGet(
      new NextRequest("http://localhost/api/members/foreign-member"),
      paramsFor("foreign-member"),
    );
    expect(foreignRes.status).toBe(404);

    const homeRes = await memberGet(
      new NextRequest(`http://localhost/api/members/${seed.members[0].id}`),
      paramsFor(seed.members[0].id),
    );
    expect(homeRes.status).toBe(200);
  });

  it("DELETE /api/bookings/:id 404s for another studio's booking, and succeeds for the caller's own", async () => {
    const seed = buildSeed(NOW);
    const repos = createInMemoryRepositories(seed);
    const foreignClassType: ClassType = {
      ...seed.classTypes[0],
      id: "foreign-class-type",
      studioId: "other-studio",
    };
    await repos.classTypes.insert(foreignClassType);
    const foreignMember: Member = {
      ...seed.members[0],
      id: "foreign-member",
      studioId: "other-studio",
    };
    await repos.members.insert(foreignMember);
    const foreignSession: ClassSession = {
      ...seed.sessions[0],
      id: "foreign-session",
      studioId: "other-studio",
      classTypeId: foreignClassType.id,
      startsAt: new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
      endsAt: new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString(),
    };
    await repos.classSessions.insert(foreignSession);
    const foreignBooking: Booking = {
      id: "foreign-booking",
      sessionId: foreignSession.id,
      memberId: foreignMember.id,
      status: "booked",
      bookedAt: NOW.toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(foreignBooking);
    __setTestRepositories(repos);

    const foreignRes = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/foreign-booking", { method: "DELETE" }),
      paramsFor("foreign-booking"),
    );
    expect(foreignRes.status).toBe(404);
    expect((await repos.bookings.getById("foreign-booking"))?.status).toBe("booked");

    // cancelBooking() compares against the real clock (`new Date()`), so the
    // "still works" fixture needs a session genuinely in the future — the
    // seed's synthetic NOW ("2026-03-15") is not reliable for that.
    const realFuture = new Date(Date.now() + 7 * 86_400_000);
    const homeSession: ClassSession = {
      ...seed.sessions[0],
      id: "home-session",
      startsAt: realFuture.toISOString(),
      endsAt: new Date(realFuture.getTime() + 3_600_000).toISOString(),
    };
    await repos.classSessions.insert(homeSession);
    const homeBooking: Booking = {
      id: "home-booking",
      sessionId: homeSession.id,
      memberId: seed.members[0].id,
      status: "booked",
      bookedAt: new Date().toISOString(),
      cancelledAt: null,
    };
    await repos.bookings.insert(homeBooking);
    const homeRes = await bookingDelete(
      new NextRequest(`http://localhost/api/bookings/${homeBooking.id}`, { method: "DELETE" }),
      paramsFor(homeBooking.id),
    );
    expect(homeRes.status).toBe(200);
  });
});
