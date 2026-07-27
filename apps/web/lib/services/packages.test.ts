import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryRepositories, type SeedData } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import { createPackage, listPackages, refundPackage } from "@/lib/services/packages";
import { HttpError } from "@/lib/http";

describe("packages service", () => {
  let seed: SeedData;

  beforeEach(() => {
    seed = buildSeed();
  });

  describe("createPackage", () => {
    it("creates a 5-credit pack with correct pricing", async () => {
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const response = await createPackage(repos, studioId, { memberId, credits: 5 });

      expect(response.memberId).toBe(memberId);
      expect(response.creditsTotal).toBe(5);
      expect(response.creditsRemaining).toBe(5);
      expect(response.priceCents).toBe(5000);
      expect(response.status).toBe("active");
    });

    it("creates a 10-credit pack with correct pricing", async () => {
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const response = await createPackage(repos, studioId, { memberId, credits: 10 });

      expect(response.creditsTotal).toBe(10);
      expect(response.creditsRemaining).toBe(10);
      expect(response.priceCents).toBe(10000);
      expect(response.status).toBe("active");
    });

    it("rejects when member not found", async () => {
      const repos = createInMemoryRepositories(seed);
      const studioId = seed.studio.id;

      await expect(
        createPackage(repos, studioId, { memberId: "nonexistent", credits: 5 }),
      ).rejects.toThrow(HttpError);
    });

    it("rejects when member is from different studio", async () => {
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const wrongStudioId = "wrong-studio-id";

      await expect(createPackage(repos, wrongStudioId, { memberId, credits: 5 })).rejects.toThrow(
        HttpError,
      );
    });
  });

  describe("listPackages", () => {
    it("returns packs for a member newest-first", async () => {
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack1 = await createPackage(repos, studioId, { memberId, credits: 5 });
      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1));
      const pack2 = await createPackage(repos, studioId, { memberId, credits: 10 });

      const packs = await listPackages(repos, memberId);

      expect(packs.length).toBe(2);
      expect(packs[0].id).toBe(pack2.id);
      expect(packs[1].id).toBe(pack1.id);
    });

    it("returns empty list when member has no packs", async () => {
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;

      const packs = await listPackages(repos, memberId);

      expect(packs).toHaveLength(0);
    });
  });

  describe("refundPackage", () => {
    it("sets pack to refunded and zeros credits", async () => {
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack = await createPackage(repos, studioId, { memberId, credits: 10 });

      const refunded = await refundPackage(repos, pack.id);

      expect(refunded.status).toBe("refunded");
      expect(refunded.creditsRemaining).toBe(0);
      expect(refunded.creditsTotal).toBe(10);
    });

    it("throws when pack not found", async () => {
      const repos = createInMemoryRepositories(seed);

      await expect(refundPackage(repos, "nonexistent-id")).rejects.toThrow(HttpError);
    });

    it("prevents drawing from refunded pack", async () => {
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack = await createPackage(repos, studioId, { memberId, credits: 5 });
      await refundPackage(repos, pack.id);

      const packs = await listPackages(repos, memberId);
      const refundedPack = packs.find((p) => p.id === pack.id);

      expect(refundedPack?.status).toBe("refunded");
      expect(refundedPack?.creditsRemaining).toBe(0);
    });
  });
});
