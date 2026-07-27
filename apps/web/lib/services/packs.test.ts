import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPack, listPacks, refundPack } from "./packs";

// Anchored to the real clock: booking rules compare against `new Date()`
// inside the services, so fixtures must be genuinely past/future.
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
  createdAt: ISO,
  ...over,
});

describe("packs service", () => {
  let repos: Repositories;
  beforeEach(async () => {
    repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
  });

  it("creates a 5-credit pack with total price 5000", async () => {
    const created = await createPack(repos, "s1", { memberId: "m1", credits: 5 });
    expect(created).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
  });

  it("creates a 10-credit pack with total price 10000", async () => {
    const created = await createPack(repos, "s1", { memberId: "m1", credits: 10 });
    expect(created).toMatchObject({
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
    });
  });

  it("lists a member's packs newest first", async () => {
    await repos.classPacks.insert(pack("older", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z" }));
    await repos.classPacks.insert(pack("newer", "m1", { purchasedAt: "2026-02-01T00:00:00.000Z" }));
    const listed = await listPacks(repos, "m1");
    expect(listed.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("refunds a pack, zeroing credits and marking it refunded", async () => {
    await repos.classPacks.insert(pack("p1", "m1"));
    const refunded = await refundPack(repos, "p1");
    expect(refunded).toMatchObject({ creditsRemaining: 0, status: "refunded" });
  });
});

describe("bookings draw from a class pack", () => {
  it("spends one credit (oldest pack first) on a confirmed booking", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        packs: [
          pack("older", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
          pack("newer", "m1", { purchasedAt: "2026-02-01T00:00:00.000Z" }),
        ],
      }),
    );
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
    expect((await repos.classPacks.getById("older"))?.creditsRemaining).toBe(4);
    expect((await repos.classPacks.getById("newer"))?.creditsRemaining).toBe(5);
  });

  it("rejects with 402 pack_exhausted once every pack is exhausted or refunded", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        packs: [
          pack("exhausted", "m1", { creditsRemaining: 0 }),
          pack("refunded", "m1", { status: "refunded" }),
        ],
      }),
    );
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    expect((await repos.bookings.listBySession("cs1")).length).toBe(0);
  });

  it("books unchanged when the member has never bought a pack", async () => {
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

  it("rejects a duplicate booking with 409 and spends no extra credit", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        classTypes: [classType("ct1")],
        sessions: [session("cs1")],
        members: [member("m1")],
        packs: [pack("p1", "m1")],
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
      }),
    );
    // Simulate that the existing booking already drew a credit.
    await repos.classPacks.update("p1", { creditsRemaining: 4 });
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });
    expect((await repos.classPacks.getById("p1"))?.creditsRemaining).toBe(4);
  });
});
