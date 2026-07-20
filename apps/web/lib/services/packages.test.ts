import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { createPackage, listPackages, refundPackage } from "./packages";
import { HttpError } from "@/lib/http";

describe("packages service", () => {
  let repos = createInMemoryRepositories();
  let studioId: string;
  let memberId: string;

  beforeEach(() => {
    const seed = buildSeed();
    repos = createInMemoryRepositories(seed);
    studioId = seed.studio.id;
    memberId = seed.members[0].id;
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack with correct price and status", async () => {
      const result = await createPackage(repos, studioId, {
        memberId,
        credits: 5,
      });

      expect(result).toMatchObject({
        memberId,
        creditsTotal: 5,
        creditsRemaining: 5,
        priceCents: 5000,
        status: "active",
      });
      expect(result.id).toBeDefined();
      expect(result.purchasedAt).toBeDefined();
    });

    it("creates a 10-credit pack with correct price", async () => {
      const result = await createPackage(repos, studioId, {
        memberId,
        credits: 10,
      });

      expect(result).toMatchObject({
        memberId,
        creditsTotal: 10,
        creditsRemaining: 10,
        priceCents: 10000,
        status: "active",
      });
    });

    it("rejects unknown member", async () => {
      await expect(
        createPackage(repos, studioId, {
          memberId: "unknown-id",
          credits: 5,
        }),
      ).rejects.toThrow(HttpError);
    });

    it("rejects member from another studio", async () => {
      const otherMember = { ...buildSeed().members[1], studioId: "other-studio" };
      await repos.members.insert(otherMember);

      await expect(
        createPackage(repos, studioId, {
          memberId: otherMember.id,
          credits: 5,
        }),
      ).rejects.toThrow(HttpError);
    });
  });

  describe("listPackages", () => {
    it("returns empty list for member with no packs", async () => {
      const result = await listPackages(repos, memberId);
      expect(result).toEqual([]);
    });

    it("returns member's packs newest first", async () => {
      const pack1 = await createPackage(repos, studioId, {
        memberId,
        credits: 5,
      });

      // Wait a tiny bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const pack2 = await createPackage(repos, studioId, {
        memberId,
        credits: 10,
      });

      const result = await listPackages(repos, memberId);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(pack2.id);
      expect(result[1].id).toBe(pack1.id);
    });
  });

  describe("refundPackage", () => {
    it("sets creditsRemaining to 0 and status to refunded", async () => {
      const pack = await createPackage(repos, studioId, {
        memberId,
        credits: 10,
      });

      const refunded = await refundPackage(repos, pack.id);

      expect(refunded).toMatchObject({
        id: pack.id,
        creditsRemaining: 0,
        status: "refunded",
      });
    });

    it("throws 404 for unknown pack", async () => {
      await expect(refundPackage(repos, "unknown-pack")).rejects.toThrow(HttpError);
    });
  });
});
