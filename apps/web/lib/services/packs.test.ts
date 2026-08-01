import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack, ClassSession, ClassType, Member } from "@/lib/db/types";
import { createFakeProvider } from "@/lib/notifications/fake-provider";
import { createBooking } from "./bookings";
import { createPack, listPacksByMember, refundPack } from "./packs";

// Anchored to the real clock: the booking rules compare against `new Date()`
// inside the services, so session fixtures must be genuinely in the future.
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
    packs: [],
    invoices: [],
    lineItems: [],
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

function reposWith(over: Partial<SeedData> = {}): Repositories {
  return createInMemoryRepositories(
    baseSeed({
      members: [member("m1")],
      classTypes: [classType("ct1")],
      sessions: [session("cs1"), session("cs2")],
      ...over,
    }),
  );
}

describe("packs service", () => {
  it("creates a 5-credit pack priced at 5000 cents total", async () => {
    const repos = reposWith();
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

  it("creates a 10-credit pack priced at 10000 cents total", async () => {
    const repos = reposWith();
    const created = await createPack(repos, "s1", { memberId: "m1", credits: 10 });
    expect(created).toMatchObject({ creditsTotal: 10, creditsRemaining: 10, priceCents: 10000 });
  });

  it("rejects a pack for an unknown member with 400", async () => {
    const repos = reposWith();
    await expect(createPack(repos, "s1", { memberId: "nope", credits: 5 })).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("lists a member's packs newest first", async () => {
    const repos = reposWith({
      packs: [
        pack("p-old", "m1", { purchasedAt: "2026-03-01T10:00:00.000Z" }),
        pack("p-new", "m1", { purchasedAt: "2026-03-02T10:00:00.000Z" }),
      ],
    });
    const list = await listPacksByMember(repos, "m1");
    expect(list.map((p) => p.id)).toEqual(["p-new", "p-old"]);
    expect(list[0]).toMatchObject({
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
  });

  it("refund voids the remaining credits", async () => {
    const repos = reposWith({ packs: [pack("p1", "m1", { creditsRemaining: 3 })] });
    const refunded = await refundPack(repos, "p1");
    expect(refunded).toMatchObject({ id: "p1", creditsRemaining: 0, status: "refunded" });
    expect((await repos.packs.getById("p1"))?.creditsRemaining).toBe(0);
  });

  it("refund 404s for an unknown pack", async () => {
    const repos = reposWith();
    await expect(refundPack(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("bookings drawing from packs", () => {
  it("a member with no pack books unchanged and spends nothing", async () => {
    const repos = reposWith();
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
  });

  it("confirms the booking and spends one credit from the oldest pack", async () => {
    const repos = reposWith({
      packs: [
        pack("p-new", "m1", { purchasedAt: "2026-03-02T10:00:00.000Z", creditsRemaining: 5 }),
        pack("p-old", "m1", { purchasedAt: "2026-03-01T10:00:00.000Z", creditsRemaining: 2 }),
      ],
    });
    const result = await createBooking(repos, createFakeProvider(), {
      sessionId: "cs1",
      memberId: "m1",
    });
    expect(result.status).toBe("booked");
    expect((await repos.packs.getById("p-old"))?.creditsRemaining).toBe(1);
    expect((await repos.packs.getById("p-new"))?.creditsRemaining).toBe(5);
  });

  it("rejects with 402 pack_exhausted when every pack is used up", async () => {
    const repos = reposWith({ packs: [pack("p1", "m1", { creditsRemaining: 0 })] });
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
    expect(await repos.bookings.listBySession("cs1")).toHaveLength(0);
  });

  it("a repeated booking is rejected 409 and spends no extra credit", async () => {
    const repos = reposWith({ packs: [pack("p1", "m1", { creditsRemaining: 5 })] });
    const provider = createFakeProvider();
    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect((await repos.packs.getById("p1"))?.creditsRemaining).toBe(4);
    await expect(
      createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 409, code: "booking_already_booked" });
    expect((await repos.packs.getById("p1"))?.creditsRemaining).toBe(4);
  });

  it("a refunded pack is never drawn from again", async () => {
    const repos = reposWith({ packs: [pack("p1", "m1", { creditsRemaining: 3 })] });
    await refundPack(repos, "p1");
    await expect(
      createBooking(repos, createFakeProvider(), { sessionId: "cs1", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
  });

  it("spends the last credit, then stops the next booking", async () => {
    const repos = reposWith({ packs: [pack("p1", "m1", { creditsRemaining: 1 })] });
    const provider = createFakeProvider();
    await createBooking(repos, provider, { sessionId: "cs1", memberId: "m1" });
    expect((await repos.packs.getById("p1"))?.creditsRemaining).toBe(0);
    await expect(
      createBooking(repos, provider, { sessionId: "cs2", memberId: "m1" }),
    ).rejects.toMatchObject({ status: 402, code: "pack_exhausted" });
  });
});
