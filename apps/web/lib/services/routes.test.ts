import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as packageRefundPost } from "@/app/api/packages/[id]/refund/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Package } from "@/lib/db/types";

// The POST handlers guard with requireSession(), which reads the Next request
// cookie store — unavailable in vitest. Stub the session check; everything
// else (validation, services, fakes) runs for real.
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: async () => ({ email: "owner@example.com" }) };
});

const NOW = new Date("2026-03-15T12:00:00.000Z");

const jsonRequest = (url: string, body: unknown): Request =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

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

describe("package + booking route handlers (against injected fake repositories)", () => {
  // Real-clock fixtures: createBooking compares session times to `new Date()`.
  const REAL_NOW = new Date();
  const ISO = REAL_NOW.toISOString();
  const FUTURE = new Date(REAL_NOW.getTime() + 7 * 86_400_000).toISOString();
  const FUTURE_END = new Date(REAL_NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
  const MONTH_AGO = new Date(REAL_NOW.getTime() - 30 * 86_400_000).toISOString();
  const WEEK_AGO = new Date(REAL_NOW.getTime() - 7 * 86_400_000).toISOString();

  const pack = (id: string, over: Partial<Package> = {}): Package => ({
    id,
    studioId: "s1",
    memberId: "m1",
    creditsTotal: 5,
    creditsRemaining: 5,
    priceCents: 5000,
    status: "active",
    purchasedAt: WEEK_AGO,
    createdAt: WEEK_AGO,
    ...over,
  });

  const seed = (packages: Package[]): SeedData => ({
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
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
      {
        id: "m1",
        studioId: "s1",
        name: "M One",
        email: "m1@e.co",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: ISO,
      },
    ],
    classTypes: [
      {
        id: "ct1",
        studioId: "s1",
        name: "Yoga",
        description: null,
        color: "#111111",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        createdAt: ISO,
      },
    ],
    sessions: [
      {
        id: "cs1",
        studioId: "s1",
        classTypeId: "ct1",
        instructor: "I",
        startsAt: FUTURE,
        endsAt: FUTURE_END,
        capacity: 10,
        priceCents: 1000,
        status: "scheduled",
        createdAt: ISO,
      },
    ],
    bookings: [],
    invoices: [],
    lineItems: [],
    packages,
    outbox: [],
  });

  beforeEach(() => {
    // The bookings route builds its provider from env; fake mode keeps the
    // test hermetic (no Resend key) while repositories stay the injected set.
    vi.stubEnv("USE_FAKE_BACKENDS", "1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    __setTestRepositories(null);
  });

  it("POST /api/packages responds 201 with the created pack", async () => {
    __setTestRepositories(createInMemoryRepositories(seed([])));
    const res = await packagesPost(
      jsonRequest("http://localhost/api/packages", { memberId: "m1", credits: 5 }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    expect(body.id).toBeTruthy();
    expect(body.purchasedAt).toBeTruthy();
  });

  it("POST /api/packages rejects a size other than 5 or 10 with 400", async () => {
    __setTestRepositories(createInMemoryRepositories(seed([])));
    const res = await packagesPost(
      jsonRequest("http://localhost/api/packages", { memberId: "m1", credits: 7 }),
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/packages lists a member's packs newest first (400 without memberId)", async () => {
    __setTestRepositories(
      createInMemoryRepositories(
        seed([pack("older", { purchasedAt: MONTH_AGO }), pack("newer", { purchasedAt: WEEK_AGO })]),
      ),
    );
    const res = await packagesGet(new NextRequest("http://localhost/api/packages?memberId=m1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string }[];
    expect(body.map((row) => row.id)).toEqual(["newer", "older"]);

    const missing = await packagesGet(new NextRequest("http://localhost/api/packages"));
    expect(missing.status).toBe(400);
  });

  it("POST /api/packages/:id/refund voids the remaining credits", async () => {
    __setTestRepositories(createInMemoryRepositories(seed([pack("p1")])));
    const res = await packageRefundPost(
      jsonRequest("http://localhost/api/packages/p1/refund", {}),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("refunded");
    expect(body.creditsRemaining).toBe(0);
  });

  it("POST /api/bookings responds 402 pack_exhausted for a used-up pack owner", async () => {
    __setTestRepositories(
      createInMemoryRepositories(seed([pack("spent", { creditsRemaining: 0 })])),
    );
    const res = await bookingsPost(
      jsonRequest("http://localhost/api/bookings", { sessionId: "cs1", memberId: "m1" }),
    );
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("pack_exhausted");
  });

  it("POST /api/bookings still 409s a repeated booking and spends no extra credit", async () => {
    const repos = createInMemoryRepositories(seed([pack("p1")]));
    __setTestRepositories(repos);
    const first = await bookingsPost(
      jsonRequest("http://localhost/api/bookings", { sessionId: "cs1", memberId: "m1" }),
    );
    expect(first.status).toBe(201);
    expect((await repos.packages.getById("p1"))?.creditsRemaining).toBe(4);

    const repeat = await bookingsPost(
      jsonRequest("http://localhost/api/bookings", { sessionId: "cs1", memberId: "m1" }),
    );
    expect(repeat.status).toBe(409);
    expect((await repos.packages.getById("p1"))?.creditsRemaining).toBe(4);
  });
});
