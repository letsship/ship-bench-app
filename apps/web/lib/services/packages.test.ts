import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassPack, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPack, listPacks, refundPack } from "./packages";

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
    packs: [],
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

const pack = (id: string, memberId: string, over: Partial<ClassPack> = {}): ClassPack => ({
  id,
  studioId: "s1",
  memberId,
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: ISO,
  ...over,
});

describe("packages service — buy and list", () => {
  it("creates an active 5-credit pack with the total price (not per-credit)", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    const created = await createPack(repos, "s1", { memberId: "m1", credits: 5 });
    expect(created).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    expect(created.id).toBeTruthy();
    expect(created.purchasedAt).toBeTruthy();
  });

  it("creates a 10-credit pack priced at 10000 total", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    const created = await createPack(repos, "s1", { memberId: "m1", credits: 10 });
    expect(created.creditsTotal).toBe(10);
    expect(created.creditsRemaining).toBe(10);
    expect(created.priceCents).toBe(10000);
  });

  it("lists a member's packs newest first", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packs: [
          pack("older", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
          pack("newer", "m1", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
        ],
      }),
    );
    const list = await listPacks(repos, "m1");
    expect(list.map((p) => p.id)).toEqual(["newer", "older"]);
    expect(list[0]).not.toHaveProperty("memberId");
  });
});

describe("packages service — bookings draw from a pack", () => {
  it("confirms the booking and decrements creditsRemaining for a member with an active pack", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        packs: [pack("p1", "m1", { creditsRemaining: 3 })],
      }),
    );
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
    const updated = await repos.packs.getById("p1");
    expect(updated?.creditsRemaining).toBe(2);
  });

  it("spends the oldest pack first", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        packs: [
          pack("newer", "m1", { creditsRemaining: 4, purchasedAt: "2026-02-01T00:00:00.000Z" }),
          pack("older", "m1", { creditsRemaining: 4, purchasedAt: "2026-01-01T00:00:00.000Z" }),
        ],
      }),
    );
    await createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" });
    expect((await repos.packs.getById("older"))?.creditsRemaining).toBe(3);
    expect((await repos.packs.getById("newer"))?.creditsRemaining).toBe(4);
  });

  it("books unchanged for a member with no pack", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
      }),
    );
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
  });

  it("rejects with 402 pack_exhausted when every pack is spent or refunded", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        packs: [
          pack("spent", "m1", { creditsRemaining: 0 }),
          pack("refunded", "m1", { creditsRemaining: 3, status: "refunded" }),
        ],
      }),
    );
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    expect(await repos.bookings.listBySession("cs1")).toHaveLength(0);
  });

  it("still rejects a duplicate booking with 409 and spends no extra credit", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        bookings: [
          {
            id: "b1",
            sessionId: "cs1",
            memberId: "m1",
            status: "booked",
            bookedAt: ISO,
            cancelledAt: null,
          },
        ],
        packs: [pack("p1", "m1", { creditsRemaining: 3 })],
      }),
    );
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });
    expect((await repos.packs.getById("p1"))?.creditsRemaining).toBe(3);
  });
});

describe("packages service — refund", () => {
  it("voids remaining credits and is never drawn from again", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        packs: [pack("p1", "m1", { creditsRemaining: 5 })],
      }),
    );
    const refunded = await refundPack(repos, "p1");
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");

    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
  });
});
