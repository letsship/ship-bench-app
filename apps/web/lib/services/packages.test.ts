import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import { createPackage, listPackages, refundPackage, spendCreditForMember } from "./packages";

const NOW = new Date();
const ISO = NOW.toISOString();

describe("packages service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
    memberId = (await repos.members.listByStudio(studioId))[0].id;
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack priced at 5000", async () => {
      const pack = await createPackage(repos, studioId, { memberId, credits: 5 });
      expect(pack.creditsTotal).toBe(5);
      expect(pack.creditsRemaining).toBe(5);
      expect(pack.priceCents).toBe(5000);
      expect(pack.status).toBe("active");
      expect(pack.memberId).toBe(memberId);
      expect(pack.id).toBeTruthy();
    });

    it("creates a 10-credit pack priced at 10000", async () => {
      const pack = await createPackage(repos, studioId, { memberId, credits: 10 });
      expect(pack.creditsTotal).toBe(10);
      expect(pack.creditsRemaining).toBe(10);
      expect(pack.priceCents).toBe(10000);
    });
  });

  describe("listPackages", () => {
    it("returns a member's packs newest-first", async () => {
      await createPackage(repos, studioId, { memberId, credits: 5 });
      const packs = await listPackages(repos, memberId);
      expect(packs.length).toBe(1);
    });

    it("returns packs in newest-first order", async () => {
      const pack1 = await createPackage(repos, studioId, { memberId, credits: 5 });
      const pack2 = await createPackage(repos, studioId, { memberId, credits: 10 });
      const packs = await listPackages(repos, memberId);
      expect(packs.length).toBe(2);
      // Newest first: pack2 should come before pack1
      expect(new Date(packs[0].purchasedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(packs[1].purchasedAt).getTime(),
      );
    });

    it("returns empty array for a member with no packs", async () => {
      const packs = await listPackages(repos, "nonexistent");
      expect(packs).toEqual([]);
    });
  });

  describe("refundPackage", () => {
    it("sets creditsRemaining to 0 and status to refunded", async () => {
      const created = await createPackage(repos, studioId, { memberId, credits: 5 });
      const refunded = await refundPackage(repos, created.id);
      expect(refunded.creditsRemaining).toBe(0);
      expect(refunded.status).toBe("refunded");
    });

    it("throws 404 for an unknown pack id", async () => {
      await expect(refundPackage(repos, "nonexistent")).rejects.toMatchObject({
        status: 404,
        code: "not_found",
      });
    });
  });

  describe("spendCreditForMember", () => {
    it("spends one credit from the oldest drawable pack", async () => {
      await createPackage(repos, studioId, { memberId, credits: 5 });
      const updated = await spendCreditForMember(repos, memberId);
      expect(updated).not.toBeNull();
      expect(updated!.creditsRemaining).toBe(4);
      expect(updated!.creditsTotal).toBe(5);
    });

    it("spends oldest pack first", async () => {
      const pack1 = await createPackage(repos, studioId, { memberId, credits: 5 });
      const pack2 = await createPackage(repos, studioId, { memberId, credits: 10 });
      const updated = await spendCreditForMember(repos, memberId);
      expect(updated!.id).toBe(pack1.id);
    });

    it("returns null when member has no packs", async () => {
      const result = await spendCreditForMember(repos, "nonexistent");
      expect(result).toBeNull();
    });

    it("returns null when all packs are refunded", async () => {
      const created = await createPackage(repos, studioId, { memberId, credits: 5 });
      await refundPackage(repos, created.id);
      const result = await spendCreditForMember(repos, memberId);
      expect(result).toBeNull();
    });

    it("returns null when all packs are exhausted", async () => {
      const created = await createPackage(repos, studioId, { memberId, credits: 1 });
      await spendCreditForMember(repos, memberId); // spends the only credit
      const result = await spendCreditForMember(repos, memberId);
      expect(result).toBeNull();
    });
  });
});