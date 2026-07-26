import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { createPackage, listPackages, refundPackage } from "./packages";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("packages service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
    memberId = (await repos.members.listByStudio(studioId))[0].id;
  });

  it("buys a 5-credit pack with the total price, not the per-credit rate", async () => {
    const pack = await createPackage(repos, studioId, { memberId, credits: 5 });
    expect(pack.creditsTotal).toBe(5);
    expect(pack.creditsRemaining).toBe(5);
    expect(pack.priceCents).toBe(5000);
    expect(pack.status).toBe("active");
  });

  it("buys a 10-credit pack with the total price", async () => {
    const pack = await createPackage(repos, studioId, { memberId, credits: 10 });
    expect(pack.creditsRemaining).toBe(10);
    expect(pack.priceCents).toBe(10000);
  });

  it("rejects a package for a member outside the studio", async () => {
    await expect(
      createPackage(repos, studioId, { memberId: "nope", credits: 5 }),
    ).rejects.toMatchObject({ status: 400, code: "bad_request" });
  });

  it("lists a member's packs newest first", async () => {
    const older = await repos.packages.insert({
      id: "older",
      studioId,
      memberId,
      creditsTotal: 5,
      creditsRemaining: 5,
      priceCents: 5000,
      status: "active",
      purchasedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = await repos.packages.insert({
      id: "newer",
      studioId,
      memberId,
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
      status: "active",
      purchasedAt: "2026-02-01T00:00:00.000Z",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    const list = await listPackages(repos, memberId);
    expect(list.map((p) => p.id)).toEqual([newer.id, older.id]);
  });

  it("refund zeroes remaining credits and marks the pack refunded", async () => {
    const pack = await createPackage(repos, studioId, { memberId, credits: 10 });
    const refunded = await refundPackage(repos, pack.id);
    expect(refunded.creditsRemaining).toBe(0);
    expect(refunded.status).toBe("refunded");
  });

  it("404s refunding an unknown package", async () => {
    await expect(refundPackage(repos, "nope")).rejects.toMatchObject({ status: 404 });
  });
});
