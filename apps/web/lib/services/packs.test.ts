import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as packagesGet, POST as packagesPost } from "@/app/api/packages/route";
import { POST as refundPost } from "@/app/api/packages/[id]/refund/route";
import { __setTestRepositories } from "@/lib/db/repos";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, ClassType, Member, Pack } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { buyPack, listPacks, refundPack } from "./packs";

// Route handlers call requireSession(); the fixture's auth is a signed cookie,
// so tests stub it to an authenticated operator.
vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => ({ email: "operator@example.com" }),
}));

// Anchored to the real clock: booking rules compare against `new Date()`.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

function baseSeed(over: Partial<SeedData> = {}): SeedData {
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
    members: [],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string, over: Partial<Member> = {}): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
  ...over,
});

const classType = (id: string): ClassType => ({
  id,
  studioId: "s1",
  name: "Yoga",
  description: null,
  color: "#111111",
  defaultCapacity: 10,
  defaultPriceCents: 1000,
  createdAt: ISO,
});

const session = (id: string, over: Partial<ClassSession> = {}): ClassSession => ({
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
  ...over,
});

const pack = (id: string, memberId: string, over: Partial<Pack> = {}): Pack => ({
  id,
  studioId: "s1",
  memberId,
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: ISO,
  createdAt: ISO,
  ...over,
});

function seedWith(...members: Member[]): SeedData {
  return baseSeed({
    members,
    classTypes: [classType("ct1")],
    sessions: [session("cs1"), session("cs2"), session("cs3")],
  });
}

describe("pack routes", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(seedWith(member("m1")));
    __setTestRepositories(repos);
  });
  afterEach(() => {
    __setTestRepositories(null);
  });

  const post = (body: unknown) =>
    packagesPost(
      new NextRequest("http://localhost/api/packages", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

  it("POST /api/packages sells a 5-credit pack for 5000 cents", async () => {
    const res = await post({ memberId: "m1", credits: 5 });
    expect(res.status).toBe(201);
    const body = await res.json();
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

  it("POST /api/packages sells a 10-credit pack for 10000 cents", async () => {
    const res = await post({ memberId: "m1", credits: 10 });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ creditsTotal: 10, priceCents: 10000 });
  });

  it("POST /api/packages rejects a non-5/10 size with 400", async () => {
    const res = await post({ memberId: "m1", credits: 7 });
    expect(res.status).toBe(400);
  });

  it("GET /api/packages?memberId= lists a member's packs newest first", async () => {
    const older = await buyPack(repos, "s1", { memberId: "m1", credits: 5 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await buyPack(repos, "s1", { memberId: "m1", credits: 10 });

    const res = await packagesGet(new NextRequest("http://localhost/api/packages?memberId=m1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; priceCents: number }[];
    expect(body.map((entry) => entry.id)).toEqual([newer.id, older.id]);
    expect(body[0]).toHaveProperty("creditsRemaining");
    expect(body[0]).not.toHaveProperty("studioId");
  });

  it("POST /api/packages/:id/refund voids the remaining credits", async () => {
    const bought = await buyPack(repos, "s1", { memberId: "m1", credits: 10 });
    const res = await refundPost(new NextRequest("http://localhost"), {
      params: Promise.resolve({ id: bought.id }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ creditsRemaining: 0, status: "refunded" });
  });
});

describe("pack service", () => {
  let repos: Repositories;
  beforeEach(() => {
    repos = createInMemoryRepositories(seedWith(member("m1")));
  });

  it("rejects a pack for a member of another studio", async () => {
    await expect(buyPack(repos, "other-studio", { memberId: "m1", credits: 5 })).rejects.toMatchObject(
      { status: 400 },
    );
  });

  it("refundPack 404s for an unknown pack", async () => {
    await expect(refundPack(repos, "missing")).rejects.toMatchObject({ status: 404 });
  });

  it("listPacks returns views newest first", async () => {
    await buyPack(repos, "s1", { memberId: "m1", credits: 5 });
    const views = await listPacks(repos, "m1");
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ creditsTotal: 5, creditsRemaining: 5, priceCents: 5000 });
  });
});

describe("bookings with class packs", () => {
  const provider = createFakeProvider();

  it("a member with an active pack books and spends one credit", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        ...seedWith(member("m1")),
        packs: [pack("p1", "m1", { creditsRemaining: 5 })],
      }),
    );
    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect(result.status).toBe("booked");
    const drawn = await repos.packs.getById("p1");
    expect(drawn?.creditsRemaining).toBe(4);
  });

  it("draws from the oldest pack first", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        ...seedWith(member("m1")),
        packs: [
          pack("p-old", "m1", { creditsRemaining: 2, purchasedAt: "2026-01-01T00:00:00.000Z" }),
          pack("p-new", "m1", { creditsRemaining: 5, purchasedAt: "2026-02-01T00:00:00.000Z" }),
        ],
      }),
    );
    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect((await repos.packs.getById("p-old"))?.creditsRemaining).toBe(1);
    expect((await repos.packs.getById("p-new"))?.creditsRemaining).toBe(5);
  });

  it("rejects with 402 pack_exhausted when every pack is empty", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        ...seedWith(member("m1")),
        packs: [pack("p1", "m1", { creditsRemaining: 0 })],
      }),
    );
    await expect(
      createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
  });

  it("rejects with 402 when the only pack was refunded", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        ...seedWith(member("m1")),
        packs: [pack("p1", "m1", { creditsRemaining: 0, status: "refunded" })],
      }),
    );
    await expect(
      createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
  });

  it("a repeated booking is 409 and spends no extra credit", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        ...seedWith(member("m1")),
        packs: [pack("p1", "m1", { creditsRemaining: 5 })],
      }),
    );
    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    await expect(
      createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });
    expect((await repos.packs.getById("p1"))?.creditsRemaining).toBe(4);
  });

  it("a refunded pack is never drawn from again", async () => {
    const repos = createInMemoryRepositories(seedWith(member("m1")));
    const bought = await buyPack(repos, "s1", { memberId: "m1", credits: 5 });
    await refundPack(repos, bought.id);
    await expect(
      createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
  });

  it("a member with no pack books exactly as today", async () => {
    const repos = createInMemoryRepositories(seedWith(member("m1")));
    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect(result.status).toBe("booked");
    const again = await createBooking(repos, provider, { sessionId: "cs2", memberId: "m1" });
    expect(again.status).toBe("booked");
  });
});
