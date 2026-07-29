import { describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Member } from "@/lib/db/types";
import { decidePackDraw } from "@/lib/domain/packs";
import { createPackage, listPackages, refundPackage } from "./packages";

const ISO = new Date("2026-03-15T12:00:00.000Z").toISOString();

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

describe("packages service", () => {
  it("creates an active 5-credit pack priced at 5000 cents", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    const created = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    expect(created.memberId).toBe("m1");
    expect(created.creditsTotal).toBe(5);
    expect(created.creditsRemaining).toBe(5);
    expect(created.priceCents).toBe(5000);
    expect(created.status).toBe("active");
    expect(created.purchasedAt).toBeTruthy();
  });

  it("creates a 10-credit pack priced at 10000 cents", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    const created = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
    expect(created.creditsRemaining).toBe(10);
    expect(created.priceCents).toBe(10000);
  });

  it("rejects a member from another studio", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({ members: [member("m1", { studioId: "s2" })] }),
    );
    await expect(createPackage(repos, "s1", { memberId: "m1", credits: 5 })).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("lists a member's packs newest first", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1"), member("m2")] }));
    const first = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    await repos.classPacks.update(first.id, { purchasedAt: "2026-01-01T10:00:00.000Z" });
    const second = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
    await repos.classPacks.update(second.id, { purchasedAt: "2026-02-01T10:00:00.000Z" });
    await createPackage(repos, "s1", { memberId: "m2", credits: 5 });

    const packs = await listPackages(repos, "m1");
    expect(packs.map((pack) => pack.id)).toEqual([second.id, first.id]);
    expect(packs[0]).not.toHaveProperty("memberId");
  });

  it("refund zeroes the remaining credits and marks the pack refunded", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    const created = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
    const refunded = await refundPackage(repos, created.id);
    expect(refunded.status).toBe("refunded");
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.creditsTotal).toBe(10);
  });

  it("refund 404s for an unknown pack", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    await expect(refundPackage(repos, "nope")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("a refunded pack is never drawn from again", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    const created = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    await refundPackage(repos, created.id);
    const packs = await repos.classPacks.listByMember("m1");
    expect(decidePackDraw(packs)).toEqual({ kind: "exhausted" });
  });
});
