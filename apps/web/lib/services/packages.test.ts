import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPackage, listPackages, refundPackage } from "./packages";

// Anchored to the real clock: booking rules compare against `new Date()`.
const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

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

function seed(): SeedData {
  return {
    studio: { id: "s1", name: "S", slug: "s", timezone: "Europe/Amsterdam", createdAt: ISO },
    settings: {
      studioId: "s1",
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: false,
      notifyCancellations: false,
      notifyWaitlistPromotions: false,
      notifyInvoices: false,
    },
    members: [member("m1"), member("m2")],
    classTypes: [classType("ct1")],
    sessions: [session("cs1"), session("cs2"), session("cs3"), session("cs4")],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
  };
}

const provider = createFakeProvider();

async function setup(): Promise<Repositories> {
  return createInMemoryRepositories(seed());
}

async function remaining(repos: Repositories, packId: string): Promise<number> {
  const pack = await repos.classPacks.getById(packId);
  return pack?.creditsRemaining ?? -1;
}

describe("packages service", () => {
  it("creates 5- and 10-credit packs priced at 1000 cents per credit", async () => {
    const repos = await setup();
    const five = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    expect(five).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    const ten = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
    expect(ten).toMatchObject({ creditsTotal: 10, creditsRemaining: 10, priceCents: 10000 });
  });

  it("lists a member's packs newest first", async () => {
    const repos = await setup();
    const first = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
    await createPackage(repos, "s1", { memberId: "m2", credits: 5 });
    const list = await listPackages(repos, "m1");
    expect(list.map((pack) => pack.id)).toEqual([second.id, first.id]);
  });

  it("a booking by a pack owner confirms and spends one credit from the oldest pack", async () => {
    const repos = await setup();
    const older = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect(result.status).toBe("booked");
    expect(await remaining(repos, older.id)).toBe(4);
    expect(await remaining(repos, newer.id)).toBe(10);
  });

  it("rejects with 402 pack_exhausted when every pack is empty or refunded", async () => {
    const repos = await setup();
    const pack = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    await repos.classPacks.update(pack.id, { creditsRemaining: 0 });
    await expect(
      createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    expect(await repos.bookings.listBySession("cs1")).toHaveLength(0);
  });

  it("a member with no pack books exactly as before", async () => {
    const repos = await setup();
    const result = await createBooking(repos, provider, { sessionId: "cs1", memberId: "m2" });
    expect(result.status).toBe("booked");
  });

  it("a repeated booking is 409 and spends no extra credit", async () => {
    const repos = await setup();
    const pack = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    await expect(
      createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await remaining(repos, pack.id)).toBe(4);
  });

  it("refund voids remaining credits and the pack is never drawn from again", async () => {
    const repos = await setup();
    const pack = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    const refunded = await refundPackage(repos, pack.id);
    expect(refunded).toMatchObject({ creditsRemaining: 0, status: "refunded" });
    await expect(
      createBooking(repos, provider, { sessionId: "cs2", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    expect(await remaining(repos, pack.id)).toBe(0);
  });

  it("refunding a missing pack is 404", async () => {
    const repos = await setup();
    await expect(refundPackage(repos, "nope")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });
});
