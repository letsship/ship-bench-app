import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as classesGet } from "@/app/api/classes/route";
import { GET as invoicesGet } from "@/app/api/invoices/route";
import { GET as membersGet } from "@/app/api/members/route";
import { POST as packagesPOST, GET as packagesGET } from "@/app/api/packages/route";
import { POST as refundPOST } from "@/app/api/packages/[id]/refund/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";

// Use the actual current time so booking service time checks work correctly
// (the service uses new Date() internally to check if sessions have started)
const NOW = new Date();

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/provider", () => ({
  createNotificationProvider: vi.fn(() => ({})),
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

describe("Packages API (POST/GET packages and refund endpoints)", () => {
  let repos = createInMemoryRepositories();
  let memberId: string;
  let seed = buildSeed(NOW);

  beforeEach(async () => {
    seed = buildSeed(NOW);
    repos = createInMemoryRepositories(seed);
    __setTestRepositories(repos);
    // Use the first seed member for consistency with other tests
    memberId = seed.members[0].id;
  });

  afterEach(() => {
    __setTestRepositories(null);
  });

  it("POST /api/packages creates a 5-credit pack and returns 201", async () => {
    const res = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBeDefined();
    expect(body.creditsTotal).toBe(5);
    expect(body.creditsRemaining).toBe(5);
    expect(body.priceCents).toBe(5000);
    expect(body.status).toBe("active");
  });

  it("POST /api/packages creates a 10-credit pack with price 10000", async () => {
    const res = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.creditsTotal).toBe(10);
    expect(body.creditsRemaining).toBe(10);
    expect(body.priceCents).toBe(10000);
  });

  it("GET /api/packages?memberId lists member's packs newest first", async () => {
    // Create two packs
    const pack1Res = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 5 }),
      }),
    );
    const pack1 = (await pack1Res.json()) as Record<string, unknown>;

    const pack2Res = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    const pack2 = (await pack2Res.json()) as Record<string, unknown>;

    // List them
    const res = await packagesGET(
      new NextRequest("http://localhost/api/packages?memberId=" + memberId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe(pack2.id);
    expect(body[1].id).toBe(pack1.id);
  });

  it("POST /api/packages/:id/refund sets creditsRemaining to 0 and status to refunded", async () => {
    const packRes = await packagesPOST(
      new Request("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify({ memberId, credits: 10 }),
      }),
    );
    const pack = (await packRes.json()) as Record<string, unknown>;

    const refundRes = await refundPOST(
      new Request("http://localhost/api/packages/" + pack.id + "/refund", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: pack.id as string }) },
    );
    expect(refundRes.status).toBe(200);
    const refunded = (await refundRes.json()) as Record<string, unknown>;
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
  });

  // Service-level tests for pack-integrated booking flow
  describe("Booking integration with packs (via services)", () => {
    let testRepos: ReturnType<typeof createInMemoryRepositories>;
    let testMemberId: string;
    let testSessionId: string;

    beforeEach(() => {
      // Create a simple test setup with services
      const testSeed = {
        studio: seed.studio,
        settings: {
          studioId: seed.studio.id,
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
            id: "test-pack-member",
            studioId: seed.studio.id,
            name: "Test Member",
            email: "test@example.com",
            phone: null,
            status: "active" as const,
            notificationsOptedOut: false,
            createdAt: NOW.toISOString(),
          },
        ],
        classTypes: seed.classTypes.slice(0, 1),
        sessions: [
          {
            id: "test-session-1",
            studioId: seed.studio.id,
            classTypeId: seed.classTypes[0].id,
            instructor: "Test Instructor",
            startsAt: new Date(NOW.getTime() + 48 * 60 * 60 * 1000).toISOString(),
            endsAt: new Date(NOW.getTime() + 49 * 60 * 60 * 1000).toISOString(),
            capacity: 10,
            priceCents: 1000,
            status: "scheduled" as const,
            createdAt: NOW.toISOString(),
          },
          {
            id: "test-session-2",
            studioId: seed.studio.id,
            classTypeId: seed.classTypes[0].id,
            instructor: "Test Instructor",
            startsAt: new Date(NOW.getTime() + 72 * 60 * 60 * 1000).toISOString(),
            endsAt: new Date(NOW.getTime() + 73 * 60 * 60 * 1000).toISOString(),
            capacity: 10,
            priceCents: 1000,
            status: "scheduled" as const,
            createdAt: NOW.toISOString(),
          },
        ],
        bookings: [],
        invoices: [],
        lineItems: [],
        outbox: [],
        packs: [],
      };
      testRepos = createInMemoryRepositories(testSeed);
      __setTestRepositories(testRepos);
      testMemberId = "test-pack-member";
      testSessionId = "test-session-1";
    });

    it("booking drops pack credits by one when member has an active pack", async () => {
      const { createPackage } = await import("@/lib/services/packages");
      const { createBooking } = await import("@/lib/services/bookings");
      const { createFakeProvider } = await import("@/lib/notifications/fake-provider");

      // Create a pack
      const pack = await createPackage(testRepos, seed.studio.id, {
        memberId: testMemberId,
        credits: 5,
      });
      expect(pack.creditsRemaining).toBe(5);

      // Book a class
      const booking = await createBooking(testRepos, createFakeProvider(), {
        sessionId: testSessionId,
        memberId: testMemberId,
      });
      expect(booking.status).toBe("booked");

      // Verify pack was decremented
      const updatedPack = await testRepos.packages.getById(pack.id);
      expect(updatedPack?.creditsRemaining).toBe(4);
    });

    it("booking is rejected with 402 pack_exhausted when all packs are empty", async () => {
      const { createPackage } = await import("@/lib/services/packages");
      const { createBooking } = await import("@/lib/services/bookings");
      const { createFakeProvider } = await import("@/lib/notifications/fake-provider");

      // Create a pack with 1 credit
      await createPackage(testRepos, seed.studio.id, {
        memberId: testMemberId,
        credits: 1,
      });

      // Book the first class (uses the credit)
      await createBooking(testRepos, createFakeProvider(), {
        sessionId: testSessionId,
        memberId: testMemberId,
      });

      // Try to book another class (no credits left)
      await expect(
        createBooking(testRepos, createFakeProvider(), {
          sessionId: "test-session-2",
          memberId: testMemberId,
        }),
      ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    });

    it("duplicate booking is rejected with 409 and spends no extra credit", async () => {
      const { createPackage } = await import("@/lib/services/packages");
      const { createBooking } = await import("@/lib/services/bookings");
      const { createFakeProvider } = await import("@/lib/notifications/fake-provider");

      // Create a pack
      const pack = await createPackage(testRepos, seed.studio.id, {
        memberId: testMemberId,
        credits: 5,
      });

      // Book once
      await createBooking(testRepos, createFakeProvider(), {
        sessionId: testSessionId,
        memberId: testMemberId,
      });

      // Try to book again (duplicate)
      await expect(
        createBooking(testRepos, createFakeProvider(), {
          sessionId: testSessionId,
          memberId: testMemberId,
        }),
      ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });

      // Verify only 1 credit was spent, not 2
      const updatedPack = await testRepos.packages.getById(pack.id);
      expect(updatedPack?.creditsRemaining).toBe(4);
    });
  });
});
