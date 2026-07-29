import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { GET as invoiceGet } from "@/app/api/invoices/[id]/route";
import { GET as memberGet } from "@/app/api/members/[id]/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

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

describe("IDOR — route handler studio scoping", () => {
  const ISO = NOW.toISOString();
  const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();

  let foreignRepos: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    foreignRepos = createInMemoryRepositories({
      studio: { id: "s1", name: "S", slug: "s", timezone: "UTC", createdAt: ISO },
      settings: {
        studioId: "s1",
        currency: "EUR",
        taxRateBps: 900,
        cancellationWindowHours: 12,
        waitlistEnabled: true,
        notifyBookingConfirmations: true,
        notifyCancellations: true,
        notifyWaitlistPromotions: true,
        notifyInvoices: true,
      },
      members: [
        { id: "m1", studioId: "s1", name: "Own", email: "own@e.co", phone: null, status: "active", notificationsOptedOut: false, createdAt: ISO },
        { id: "m_foreign", studioId: "s2", name: "Foreign", email: "foreign@e.co", phone: null, status: "active", notificationsOptedOut: false, createdAt: ISO },
      ],
      classTypes: [
        { id: "ct1", studioId: "s1", name: "Yoga", description: null, color: "#000", defaultCapacity: 10, defaultPriceCents: 1000, createdAt: ISO },
      ],
      sessions: [
        { id: "cs1", studioId: "s1", classTypeId: "ct1", instructor: "I", startsAt: FUTURE, endsAt: new Date(NOW.getTime() + 7 * 86_400_000 + 3600000).toISOString(), capacity: 10, priceCents: 1000, status: "scheduled", createdAt: ISO },
        { id: "cs_foreign", studioId: "s2", classTypeId: "ct1", instructor: "I", startsAt: FUTURE, endsAt: new Date(NOW.getTime() + 7 * 86_400_000 + 3600000).toISOString(), capacity: 10, priceCents: 1000, status: "scheduled", createdAt: ISO },
      ],
      bookings: [
        { id: "b1", sessionId: "cs1", memberId: "m1", status: "booked", bookedAt: ISO, cancelledAt: null },
        { id: "b_foreign", sessionId: "cs_foreign", memberId: "m_foreign", status: "booked", bookedAt: ISO, cancelledAt: null },
      ],
      invoices: [
        { id: "inv1", studioId: "s1", memberId: "m1", number: "INV-001", status: "open", currency: "EUR", taxRateBps: 900, subtotalCents: 1000, taxCents: 90, totalCents: 1090, issuedAt: ISO, dueAt: FUTURE, paidAt: null, createdAt: ISO },
        { id: "inv_foreign", studioId: "s2", memberId: "m_foreign", number: "INV-002", status: "open", currency: "EUR", taxRateBps: 900, subtotalCents: 2000, taxCents: 180, totalCents: 2180, issuedAt: ISO, dueAt: FUTURE, paidAt: null, createdAt: ISO },
      ],
      lineItems: [],
      outbox: [],
    });
    __setTestRepositories(foreignRepos);
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("GET /api/invoices/:id returns own-studio invoice", async () => {
    const res = await invoiceGet(new NextRequest("http://localhost/api/invoices/inv1"), {
      params: Promise.resolve({ id: "inv1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoice.id).toBe("inv1");
  });

  it("GET /api/invoices/:id rejects foreign-studio invoice with 404", async () => {
    const res = await invoiceGet(new NextRequest("http://localhost/api/invoices/inv_foreign"), {
      params: Promise.resolve({ id: "inv_foreign" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/members/:id returns own-studio member", async () => {
    const res = await memberGet(new NextRequest("http://localhost/api/members/m1"), {
      params: Promise.resolve({ id: "m1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("m1");
  });

  it("GET /api/members/:id rejects foreign-studio member with 404", async () => {
    const res = await memberGet(new NextRequest("http://localhost/api/members/m_foreign"), {
      params: Promise.resolve({ id: "m_foreign" }),
    });
    expect(res.status).toBe(404);
  });
});
