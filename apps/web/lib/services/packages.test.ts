import { beforeEach, describe, expect, it } from "vitest";
import { type SeedData, createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack, Member } from "@/lib/db/types";
import { createPackage, drawCreditForMember, listPackages, refundPackage } from "./packages";

const ISO = "2026-03-15T12:00:00.000Z";

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

describe("createPackage", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
  });

  it("creates an active 5-credit pack priced at 5000", async () => {
    const row = await createPackage(repos, "s1", { memberId: "m1", credits: 5 });
    expect(row).toMatchObject({
      memberId: "m1",
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
    });
    expect(row.id).toBeTruthy();
    expect(row.purchasedAt).toBeTruthy();
  });

  it("creates an active 10-credit pack priced at 10000", async () => {
    const row = await createPackage(repos, "s1", { memberId: "m1", credits: 10 });
    expect(row).toMatchObject({
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
      status: "active",
    });
  });

  it("rejects an unknown member with 400", async () => {
    await expect(createPackage(repos, "s1", { memberId: "nope", credits: 5 })).rejects.toMatchObject(
      { status: 400, code: "bad_request" },
    );
  });
});

describe("listPackages", () => {
  it("lists a member's packs newest first", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packs: [
          pack("p-old", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z" }),
          pack("p-new", "m1", { purchasedAt: "2026-06-01T00:00:00.000Z" }),
        ],
      }),
    );
    const rows = await listPackages(repos, "m1");
    expect(rows.map((row) => row.id)).toEqual(["p-new", "p-old"]);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["creditsRemaining", "creditsTotal", "id", "priceCents", "purchasedAt", "status"].sort(),
    );
  });

  it("returns only the requested member's packs", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1"), member("m2")],
        packs: [pack("p1", "m1"), pack("p2", "m2")],
      }),
    );
    expect((await listPackages(repos, "m1")).map((row) => row.id)).toEqual(["p1"]);
  });
});

describe("refundPackage", () => {
  it("voids the remaining credits and flips status to refunded", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packs: [pack("p1", "m1", { creditsRemaining: 3, creditsTotal: 5 })],
      }),
    );
    const refunded = await refundPackage(repos, "p1");
    expect(refunded).toMatchObject({ id: "p1", creditsRemaining: 0, status: "refunded" });
    expect((await repos.packages.getById("p1"))?.creditsRemaining).toBe(0);
  });

  it("is idempotent on an already-refunded pack", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packs: [pack("p1", "m1", { status: "refunded", creditsRemaining: 0 })],
      }),
    );
    const refunded = await refundPackage(repos, "p1");
    expect(refunded).toMatchObject({ status: "refunded", creditsRemaining: 0 });
  });

  it("404s for an unknown pack", async () => {
    const repos = createInMemoryRepositories(baseSeed());
    await expect(refundPackage(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("drawCreditForMember", () => {
  it("returns null when the member owns no packs", async () => {
    const repos = createInMemoryRepositories(baseSeed({ members: [member("m1")] }));
    expect(await drawCreditForMember(repos, "m1")).toBeNull();
  });

  it("picks the oldest active pack with credits remaining", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packs: [
          pack("p-new", "m1", { purchasedAt: "2026-06-01T00:00:00.000Z", creditsRemaining: 2 }),
          pack("p-old", "m1", { purchasedAt: "2026-01-01T00:00:00.000Z", creditsRemaining: 1 }),
        ],
      }),
    );
    expect((await drawCreditForMember(repos, "m1"))?.id).toBe("p-old");
  });

  it("throws 402 pack_exhausted when every pack is spent or refunded", async () => {
    const repos = createInMemoryRepositories(
      baseSeed({
        members: [member("m1")],
        packs: [
          pack("p1", "m1", { creditsRemaining: 0 }),
          pack("p2", "m1", { status: "refunded", creditsRemaining: 4 }),
        ],
      }),
    );
    await expect(drawCreditForMember(repos, "m1")).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
  });
});
