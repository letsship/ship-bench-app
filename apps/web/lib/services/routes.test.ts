import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as invoiceGet, PATCH as invoicePatch } from "@/app/api/invoices/[id]/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as memberGet, PATCH as memberPatch } from "@/app/api/members/[id]/route";
import { DELETE as bookingDelete } from "@/app/api/bookings/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

const NOW = new Date("2026-03-15T12:00:00.000Z");

const cookieStore = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
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

describe("cross-studio id scoping on [id] routes", () => {
  const otherStudioId = "other-studio";
  const otherMemberId = "other-member";
  const otherInvoiceId = "other-invoice";
  const otherSessionId = "other-session";
  const otherBookingId = "other-booking";

  const ownSessionId = "own-future-session";
  const ownBookingId = "own-future-booking";

  let ownMemberId: string;
  let ownInvoiceId: string;

  beforeEach(async () => {
    const seed = buildSeed(NOW);
    ownMemberId = seed.members[0].id;
    ownInvoiceId = seed.invoices[0].id;

    const repos = createInMemoryRepositories({
      ...seed,
      members: [
        ...seed.members,
        {
          id: otherMemberId,
          studioId: otherStudioId,
          name: "Other Studio Member",
          email: "other@example.com",
          phone: null,
          status: "active",
          notificationsOptedOut: false,
          createdAt: NOW.toISOString(),
        },
      ],
      invoices: [
        ...seed.invoices,
        {
          id: otherInvoiceId,
          studioId: otherStudioId,
          memberId: otherMemberId,
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
        },
      ],
      sessions: [
        ...seed.sessions,
        {
          id: otherSessionId,
          studioId: otherStudioId,
          classTypeId: seed.classTypes[0].id,
          instructor: "Other Instructor",
          startsAt: new Date(NOW.getTime() + 7 * 86_400_000).toISOString(),
          endsAt: new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString(),
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: NOW.toISOString(),
        },
        // cancelBooking compares against the real clock (not the seed's fixed
        // NOW), so this session must be genuinely still upcoming.
        {
          id: ownSessionId,
          studioId: seed.studio.id,
          classTypeId: seed.classTypes[0].id,
          instructor: "Own Instructor",
          startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          endsAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString(),
          capacity: 10,
          priceCents: 1000,
          status: "scheduled",
          createdAt: NOW.toISOString(),
        },
      ],
      bookings: [
        ...seed.bookings,
        {
          id: otherBookingId,
          sessionId: otherSessionId,
          memberId: otherMemberId,
          status: "booked",
          bookedAt: NOW.toISOString(),
          cancelledAt: null,
        },
        {
          id: ownBookingId,
          sessionId: ownSessionId,
          memberId: ownMemberId,
          status: "booked",
          bookedAt: NOW.toISOString(),
          cancelledAt: null,
        },
      ],
    });
    __setTestRepositories(repos);
    cookieStore.clear();
    const { createSessionToken, SESSION_COOKIE } = await import("@/lib/auth/session");
    cookieStore.set(SESSION_COOKIE, await createSessionToken("agent@example.com"));
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
  });

  afterEach(() => {
    __setTestRepositories(null);
    cookieStore.clear();
    vi.unstubAllEnvs();
  });

  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("GET /api/invoices/:id 404s for another studio's invoice and 200s for its own", async () => {
    const otherRes = await invoiceGet(
      new NextRequest("http://localhost/api/invoices/x"),
      params(otherInvoiceId),
    );
    expect(otherRes.status).toBe(404);

    const ownRes = await invoiceGet(
      new NextRequest("http://localhost/api/invoices/x"),
      params(ownInvoiceId),
    );
    expect(ownRes.status).toBe(200);
  });

  it("PATCH /api/invoices/:id 404s for another studio's invoice", async () => {
    const res = await invoicePatch(
      new NextRequest("http://localhost/api/invoices/x", {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      }),
      params(otherInvoiceId),
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id 404s for another studio's member and 200s for its own", async () => {
    const otherRes = await memberGet(
      new NextRequest("http://localhost/api/members/x"),
      params(otherMemberId),
    );
    expect(otherRes.status).toBe(404);

    const ownRes = await memberGet(
      new NextRequest("http://localhost/api/members/x"),
      params(ownMemberId),
    );
    expect(ownRes.status).toBe(200);
  });

  it("PATCH /api/members/:id 404s for another studio's member", async () => {
    const res = await memberPatch(
      new NextRequest("http://localhost/api/members/x", {
        method: "PATCH",
        body: JSON.stringify({ status: "paused" }),
      }),
      params(otherMemberId),
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /api/bookings/:id 404s for another studio's booking and 200s for its own", async () => {
    const otherRes = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/x", { method: "DELETE" }),
      params(otherBookingId),
    );
    expect(otherRes.status).toBe(404);

    const ownRes = await bookingDelete(
      new NextRequest("http://localhost/api/bookings/x", { method: "DELETE" }),
      params(ownBookingId),
    );
    expect(ownRes.status).toBe(200);
  });
});
