import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { ClassSession, ClassType, Member, Package } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { buyPackage, listPackages, refundPackage, spendCreditForMember } from "./packages";

// Anchored to the real clock, like services.test.ts: createBooking compares
// session times against `new Date()`, so fixtures must be genuinely future.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();
const MONTH_AGO = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
const WEEK_AGO = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();

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
    packages: [],
    outbox: [],
    ...over,
  };
}

const member = (id: string): Member => ({
  id,
  studioId: "s1",
  name: id,
  email: `${id}@e.co`,
  phone: null,
  status: "active",
  notificationsOptedOut: false,
  createdAt: ISO,
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

const session = (id: string): ClassSession => ({
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
});

const pack = (id: string, memberId: string, over: Partial<Package> = {}): Package => ({
  id,
  studioId: "s1",
  memberId,
  creditsTotal: 5,
  creditsRemaining: 5,
  priceCents: 5000,
  status: "active",
  purchasedAt: WEEK_AGO,
  createdAt: WEEK_AGO,
  ...over,
});

describe("packages service", () => {
  it("buys a pack priced at 1000 cents per credit", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    const bought = await buyPackage(repos, "s1", { memberId: "m1", credits: 5 });
    expect(bought).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    expect(bought.id).toBeTruthy();
    expect(bought.purchasedAt).toBeTruthy();

    const ten = await buyPackage(repos, "s1", { memberId: "m1", credits: 10 });
    expect(ten.priceCents).toBe(10000);
    expect(ten.creditsRemaining).toBe(10);
  });

  it("rejects buying for an unknown or other-studio member with 404", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    await expect(buyPackage(repos, "s1", { memberId: "nope", credits: 5 })).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      buyPackage(repos, "other-studio", { memberId: "m1", credits: 5 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lists a member's packs newest first", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packages: [
          pack("older", "m1", { purchasedAt: MONTH_AGO }),
          pack("newer", "m1", { purchasedAt: WEEK_AGO }),
        ],
      }),
    );
    const list = await listPackages(repos, "m1");
    expect(list.map((row) => row.id)).toEqual(["newer", "older"]);
    expect(list[0]).toMatchObject({
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: WEEK_AGO,
    });
  });

  it("refund voids the remaining credits", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({ members: [member("m1")], packages: [pack("p1", "m1", { creditsRemaining: 3 })] }),
    );
    const refunded = await refundPackage(repos, "p1");
    expect(refunded.status).toBe("refunded");
    expect(refunded.creditsRemaining).toBe(0);
    await expect(refundPackage(repos, "missing")).rejects.toMatchObject({ status: 404 });
  });

  it("spends one credit from the oldest active pack", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packages: [
          pack("newer", "m1", { purchasedAt: WEEK_AGO }),
          pack("older", "m1", { purchasedAt: MONTH_AGO, creditsRemaining: 2 }),
        ],
      }),
    );
    await spendCreditForMember(repos, "m1");
    expect((await repos.packages.getById("older"))?.creditsRemaining).toBe(1);
    expect((await repos.packages.getById("newer"))?.creditsRemaining).toBe(5);
  });

  it("is a no-op for a member with no packs", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    await expect(spendCreditForMember(repos, "m1")).resolves.toBeUndefined();
  });

  it("throws 402 pack_exhausted when every pack is used up or refunded", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packages: [
          pack("spent", "m1", { creditsRemaining: 0 }),
          pack("refunded", "m1", { status: "refunded", creditsRemaining: 0 }),
        ],
      }),
    );
    await expect(spendCreditForMember(repos, "m1")).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
  });
});

describe("bookings draw from class packs", () => {
  const bookingSeed = (packages: Package[], members = [member("m1")]): SeedData =>
    baseSeed({
      members,
      classTypes: [classType("ct1")],
      sessions: [session("cs1")],
      packages,
    });

  it("confirms the booking and spends one credit, oldest pack first", async () => {
    const repos = createInMemoryRepositories(
      bookingSeed([
        pack("newer", "m1", { purchasedAt: WEEK_AGO }),
        pack("older", "m1", { purchasedAt: MONTH_AGO, creditsRemaining: 4 }),
      ]),
    );
    const provider = createFakeProvider();
    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect(result.status).toBe("booked");
    expect(provider.sent.map((m) => m.kind)).toEqual(["booking_confirmation"]);
    expect((await repos.packages.getById("older"))?.creditsRemaining).toBe(3);
    expect((await repos.packages.getById("newer"))?.creditsRemaining).toBe(5);
  });

  it("rejects an exhausted pack owner with 402 and creates no booking", async () => {
    const repos = createInMemoryRepositories(
      bookingSeed([
        pack("spent", "m1", { creditsRemaining: 0 }),
        pack("refunded", "m1", { status: "refunded", creditsRemaining: 0 }),
      ]),
    );
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    expect(await repos.bookings.listBySession("cs1")).toEqual([]);
  });

  it("never draws from a refunded pack again", async () => {
    const repos = createInMemoryRepositories(
      bookingSeed([pack("refunded", "m1", { status: "refunded", creditsRemaining: 3 })]),
    );
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    expect((await repos.packages.getById("refunded"))?.creditsRemaining).toBe(3);
  });

  it("books a member with no pack exactly as before", async () => {
    const repos = createInMemoryRepositories(bookingSeed([]));
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
  });

  it("rejects a repeated booking with 409 and spends no extra credit", async () => {
    const repos = createInMemoryRepositories(bookingSeed([pack("p1", "m1")]));
    const provider = createFakeProvider();
    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect((await repos.packages.getById("p1"))?.creditsRemaining).toBe(4);

    await expect(
      createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });
    expect((await repos.packages.getById("p1"))?.creditsRemaining).toBe(4);
  });
});
