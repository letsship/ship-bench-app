import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { listClassPackages, purchaseClassPackage, refundClassPackage } from "./class-packages";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("class packages service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
    memberId = (await repos.members.listByStudio(studioId))[0].id;
  });

  it("purchases a 5-credit pack with the right total/remaining/price", async () => {
    const pack = await purchaseClassPackage(repos, studioId, { memberId, credits: 5 });
    expect(pack.creditsTotal).toBe(5);
    expect(pack.creditsRemaining).toBe(5);
    expect(pack.priceCents).toBe(5000);
    expect(pack.status).toBe("active");
  });

  it("purchases a 10-credit pack with the right total/remaining/price", async () => {
    const pack = await purchaseClassPackage(repos, studioId, { memberId, credits: 10 });
    expect(pack.creditsTotal).toBe(10);
    expect(pack.creditsRemaining).toBe(10);
    expect(pack.priceCents).toBe(10000);
  });

  it("rejects a member outside the studio", async () => {
    await expect(
      purchaseClassPackage(repos, "some-other-studio", { memberId, credits: 5 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("lists a member's packs newest first", async () => {
    await repos.classPackages.insert({
      id: "old",
      studioId,
      memberId,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2026-01-01T00:00:00.000Z",
    });
    await repos.classPackages.insert({
      id: "new",
      studioId,
      memberId,
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
      status: "active",
      purchasedAt: "2026-02-01T00:00:00.000Z",
    });
    const list = await listClassPackages(repos, memberId);
    expect(list.map((p) => p.id)).toEqual(["new", "old"]);
  });

  it("refund zeroes remaining credits and flips status", async () => {
    const pack = await purchaseClassPackage(repos, studioId, { memberId, credits: 10 });
    const refunded = await refundClassPackage(repos, pack.id);
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
  });

  it("refund of an unknown id 404s", async () => {
    await expect(refundClassPackage(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });
});
