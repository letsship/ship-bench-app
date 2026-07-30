import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as bookingsPost } from "@/app/api/bookings/route";
import { POST as refundPost } from "@/app/api/packages/[id]/refund/route";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";

// Packs are exercised through the real route handlers with in-memory
// repositories injected, the same way routes.test.ts drives the GET routes.
// The session cookie is the one thing a unit test cannot mint, so the auth
// seam is stubbed; everything else is the production code path.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "desk@riverbank.studio" }),
}));

// The booking rules compare against the real clock, so fixtures must be
// genuinely in the future.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

const pack = (id: string, memberId: string, over: Partial<ClassPack> = {}): ClassPack => ({
  id,
  memberId,
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: ISO,
  ...over,
});

function seedWith(packs: ClassPack[]): SeedData {
  return {
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
    members: ["m1", "m2"].map((id) => ({
      id,
      studioId: "s1",
      name: id,
      email: `${id}@e.co`,
      phone: null,
      status: "active",
      notificationsOptedOut: false,
      createdAt: ISO,
    })),
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
    sessions: ["sess1", "sess2"].map((id) => ({
      id,
      studioId: "s1",
      classTypeId: "ct1",
      instructor: "I",
      startsAt: FUTURE,
      endsAt: FUTURE_END,
      capacity: 10,
      priceCents: 1000,
      status: "scheduled",
      createdAt: ISO,
    })),
    bookings: [],
    packs,
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

let repos: Repositories;

function install(packs: ClassPack[] = []): void {
  repos = createInMemoryRepositories(seedWith(packs));
  __setTestRepositories(repos);
}

const postPackage = (body: unknown): Promise<Response> =>
  packagesPost(
    new Request("http://localhost/api/packages", { method: "POST", body: JSON.stringify(body) }),
  );

const listPackagesFor = (memberId: string): Promise<Response> =>
  packagesGet(new NextRequest(`http://localhost/api/packages?memberId=${memberId}`));

const book = (memberId: string, sessionId = "sess1"): Promise<Response> =>
  bookingsPost(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      body: JSON.stringify({ memberId, sessionId }),
    }),
  );

const refund = (id: string): Promise<Response> =>
  refundPost(new Request(`http://localhost/api/packages/${id}/refund`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });

const creditsOf = async (id: string): Promise<number | undefined> =>
  (await repos.classPacks.getById(id))?.creditsRemaining;

beforeEach(() => {
  // The bookings route builds a notification provider; the fake one needs no
  // vendor credentials. Repositories are still the injected fakes.
  vi.stubEnv("USE_FAKE_BACKENDS", "1");
  install();
});
afterEach(() => {
  __setTestRepositories(null);
  vi.unstubAllEnvs();
});

describe("POST /api/packages", () => {
  it("sells a 5-credit pack for 5000 cents", async () => {
    const res = await postPackage({ memberId: "m1", credits: 5 });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
  });

  it("sells a 10-credit pack for 10000 cents and returns the documented shape", async () => {
    const res = await postPackage({ memberId: "m1", credits: 10 });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        "creditsRemaining",
        "creditsTotal",
        "id",
        "memberId",
        "priceCents",
        "purchasedAt",
        "status",
      ].sort(),
    );
    expect(body.priceCents).toBe(10_000);
    expect(Number.isNaN(Date.parse(String(body.purchasedAt)))).toBe(false);
  });

  it("rejects a pack size that is not 5 or 10", async () => {
    const res = await postPackage({ memberId: "m1", credits: 7 });
    expect(res.status).toBe(400);
  });

  it("404s for an unknown member", async () => {
    const res = await postPackage({ memberId: "nope", credits: 5 });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/packages", () => {
  it("lists only that member's packs, newest first", async () => {
    install([
      pack("older", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
      pack("newer", "m1", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
      pack("other", "m2"),
    ]);
    const res = await listPackagesFor("m1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body.map((row) => row.id)).toEqual(["newer", "older"]);
    expect(Object.keys(body[0]).sort()).toEqual([
      "creditsRemaining",
      "creditsTotal",
      "id",
      "priceCents",
      "purchasedAt",
      "status",
    ]);
  });

  it("400s without a memberId", async () => {
    const res = await packagesGet(new NextRequest("http://localhost/api/packages"));
    expect(res.status).toBe(400);
  });
});

describe("bookings drawing from a pack", () => {
  it("confirms the booking and spends one credit from the oldest pack", async () => {
    install([
      pack("newer", "m1", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
      pack("older", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
    ]);
    const res = await book("m1");
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "booked" });
    expect(await creditsOf("older")).toBe(4);
    expect(await creditsOf("newer")).toBe(5);
  });

  it("leaves a member with no pack booking exactly as before", async () => {
    const res = await book("m1");
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "booked" });
    expect((await repos.bookings.listBySession("sess1")).length).toBe(1);
  });

  it("rejects with 402 pack_exhausted when every pack is spent or refunded", async () => {
    install([
      pack("spent", "m1", { creditsRemaining: 0 }),
      pack("refunded", "m1", { status: "refunded", creditsRemaining: 0 }),
    ]);
    const res = await book("m1");
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: { code: "pack_exhausted" } });
    expect(await repos.bookings.listBySession("sess1")).toEqual([]);
  });

  it("spends the last credit, then blocks the next booking", async () => {
    install([pack("p1", "m1", { creditsTotal: 1, creditsRemaining: 1 })]);
    expect((await book("m1", "sess1")).status).toBe(201);
    expect(await creditsOf("p1")).toBe(0);
    expect((await book("m1", "sess2")).status).toBe(402);
  });

  it("spends no extra credit when the same session is booked twice", async () => {
    install([pack("p1", "m1")]);
    expect((await book("m1")).status).toBe(201);
    const repeat = await book("m1");
    expect(repeat.status).toBe(409);
    expect(await repeat.json()).toMatchObject({ error: { code: "booking_already_booked" } });
    expect(await creditsOf("p1")).toBe(4);
  });
});

describe("POST /api/packages/:id/refund", () => {
  it("voids the remaining credits", async () => {
    install([pack("p1", "m1", { creditsRemaining: 3 })]);
    const res = await refund("p1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "refunded", creditsRemaining: 0 });
  });

  it("is never drawn from again, so the next booking is 402", async () => {
    install([pack("p1", "m1", { creditsRemaining: 3 })]);
    expect((await refund("p1")).status).toBe(200);
    const res = await book("m1");
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: { code: "pack_exhausted" } });
  });

  it("404s for an unknown pack", async () => {
    expect((await refund("nope")).status).toBe(404);
  });
});
