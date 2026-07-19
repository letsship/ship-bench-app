import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { newId } from "@/lib/db/ids";
import type { Member, Studio, StudioSettings } from "@/lib/db/types";
import { buyClassPack, listClassPacks, refundClassPack } from "./class-packs";

const baseSeed = () => {
  const studioId = newId();
  const memberId = newId();

  return {
    studio: {
      id: studioId,
      name: "Test Studio",
      slug: "test",
      timezone: "UTC",
      createdAt: new Date().toISOString(),
    } as Studio,
    settings: {
      studioId,
      currency: "EUR",
      taxRateBps: 0,
      cancellationWindowHours: 12,
      waitlistEnabled: true,
      notifyBookingConfirmations: true,
      notifyCancellations: true,
      notifyWaitlistPromotions: true,
      notifyInvoices: true,
    } as StudioSettings,
    members: [
      {
        id: memberId,
        studioId,
        name: "Test Member",
        email: "test@example.com",
        phone: null,
        status: "active",
        notificationsOptedOut: false,
        createdAt: new Date().toISOString(),
      } as Member,
    ],
    classTypes: [],
    sessions: [],
    bookings: [],
    invoices: [],
    lineItems: [],
    outbox: [],
    classPacks: [],
  };
};

describe("class-packs service", () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;
  let memberId: string;

  beforeEach(() => {
    const seed = baseSeed();
    repos = createInMemoryRepositories(seed);
    memberId = seed.members[0].id;
  });

  it("should buy a 5-credit pack", async () => {
    const result = await buyClassPack(repos, { memberId, credits: 5 });

    expect(result.creditsTotal).toBe(5);
    expect(result.creditsRemaining).toBe(5);
    expect(result.priceCents).toBe(5000);
    expect(result.status).toBe("active");
    expect(result.memberId).toBe(memberId);
  });

  it("should buy a 10-credit pack", async () => {
    const result = await buyClassPack(repos, { memberId, credits: 10 });

    expect(result.creditsTotal).toBe(10);
    expect(result.creditsRemaining).toBe(10);
    expect(result.priceCents).toBe(10000);
    expect(result.status).toBe("active");
  });

  it("should list packs for a member (newest first)", async () => {
    await buyClassPack(repos, { memberId, credits: 5 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await buyClassPack(repos, { memberId, credits: 10 });

    const packs = await listClassPacks(repos, memberId);

    expect(packs).toHaveLength(2);
    expect(packs[0].creditsTotal).toBe(10);
    expect(packs[1].creditsTotal).toBe(5);
  });

  it("should refund a pack", async () => {
    const bought = await buyClassPack(repos, { memberId, credits: 5 });
    const refunded = await refundClassPack(repos, bought.id);

    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
    expect(refunded.creditsTotal).toBe(5);
  });

  it("should error on refunding non-existent pack", async () => {
    await expect(refundClassPack(repos, "nonexistent")).rejects.toThrow("Pack not found");
  });
});
