import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPackage, listMemberPackages, refundPackage } from "./class-packs";

const NOW = new Date();
const ISO = NOW.toISOString();
const FUTURE = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
const FUTURE_END = new Date(NOW.getTime() + 7 * 86_400_000 + 3_600_000).toISOString();

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
    classTypes: [classType("ct1")],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    packages: [],
    ...over,
  };
}

describe("class packs service", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
  });

  it("buys a 5-credit pack", async () => {
    const created = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
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

  it("buys a 10-credit pack", async () => {
    const created = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
    expect(created).toMatchObject({
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
    });
  });

  it("404s buying a pack for an unknown member", async () => {
    await expect(
      createPackage(repos, "s1", { memberId: "nope", credits: 5 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lists a member's packs newest first", async () => {
    const older = pack("p1", "m1", { purchasedAt: "2026-01-01T00:00:00Z" });
    const newer = pack("p2", "m1", { purchasedAt: "2026-02-01T00:00:00Z" });
    repos = createInMemoryRepositories(
      baseSeed({ members: [member("m1")], packages: [older, newer] }),
    );
    const list = await listMemberPackages(repos, "m1");
    expect(list.map((p) => p.id)).toEqual(["p2", "p1"]);
  });

  it("refund zeroes credits and flips status", async () => {
    repos = createInMemoryRepositories(
      baseSeed({ members: [member("m1")], packages: [pack("p1", "m1")] }),
    );
    const refunded = await refundPackage(repos, "p1");
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
  });

  it("404s refunding an unknown pack", async () => {
    await expect(refundPackage(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });

  it("draws one credit from the oldest pack when a pack-owner books", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        packages: [
          pack("p1", "m1", { purchasedAt: "2026-01-01T00:00:00Z" }),
          pack("p2", "m1", { purchasedAt: "2026-02-01T00:00:00Z" }),
        ],
      }),
    );
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
    const [oldest, newest] = await listMemberPackages(repos, "m1").then((list) =>
      [...list].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(oldest.creditsRemaining).toBe(4);
    expect(newest.creditsRemaining).toBe(5);
  });

  it("rejects booking with 402 pack_exhausted when no credits are drawable", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
        packages: [pack("p1", "m1", { creditsRemaining: 0 })],
      }),
    );
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    const [only] = await listMemberPackages(repos, "m1");
    expect(only.creditsRemaining).toBe(0);
  });

  it("books unchanged for a member who never bought a pack", async () => {
    repos = createInMemoryRepositories(
      baseSeed({ members: [member("m1")], sessions: [session("cs1")] }),
    );
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
    expect(await listMemberPackages(repos, "m1")).toEqual([]);
  });

  it("rejects a duplicate booking with 409 and spends no extra credit", async () => {
    repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        sessions: [session("cs1")],
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
        packages: [pack("p1", "m1")],
      }),
    );
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 409 });
    const [only] = await listMemberPackages(repos, "m1");
    expect(only.creditsRemaining).toBe(5);
  });
});
