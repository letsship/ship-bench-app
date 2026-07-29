import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/db/seed-data";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { HttpError } from "@/lib/http";
import { createPackage, listActivePackages, spendCreditForBooking } from "./packages";

describe("services/packages", () => {
  describe("createPackage", () => {
    it("creates a 10-pack with correct pricing", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack = await createPackage(repos, studioId, {
        memberId,
        credits: 10,
      });
      expect(pack.credits).toBe(10);
      expect(pack.creditsRemaining).toBe(10);
      expect(pack.priceCents).toBe(10000);
      expect(pack.status).toBe("active");
    });

    it("creates a 5-pack with correct pricing", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack = await createPackage(repos, studioId, {
        memberId,
        credits: 5,
      });
      expect(pack.credits).toBe(5);
      expect(pack.creditsRemaining).toBe(5);
      expect(pack.priceCents).toBe(5000);
    });
  });

  describe("listActivePackages", () => {
    it("returns empty list for member with no packs", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;

      const packs = await listActivePackages(repos, memberId);
      expect(packs).toEqual([]);
    });

    it("returns active packs for member", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack1 = await createPackage(repos, studioId, {
        memberId,
        credits: 10,
      });
      const pack2 = await createPackage(repos, studioId, {
        memberId,
        credits: 5,
      });
      const packs = await listActivePackages(repos, memberId);
      expect(packs.length).toBe(2);
      expect(packs[0].id).toBe(pack1.id);
      expect(packs[1].id).toBe(pack2.id);
    });
  });

  describe("spendCreditForBooking", () => {
    it("is a no-op for member with no packs", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;

      await expect(spendCreditForBooking(repos, memberId)).resolves.toBeUndefined();
    });

    it("deducts one credit from oldest pack", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack = await createPackage(repos, studioId, {
        memberId,
        credits: 10,
      });
      await spendCreditForBooking(repos, memberId);
      const updated = await repos.classPacks.getById(pack.id);
      expect(updated?.creditsRemaining).toBe(9);
    });

    it("deducts from oldest pack first when multiple exist", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack1 = await createPackage(repos, studioId, {
        memberId,
        credits: 5,
      });
      const pack2 = await createPackage(repos, studioId, {
        memberId,
        credits: 10,
      });
      await spendCreditForBooking(repos, memberId);
      const updated1 = await repos.classPacks.getById(pack1.id);
      const updated2 = await repos.classPacks.getById(pack2.id);
      expect(updated1?.creditsRemaining).toBe(4);
      expect(updated2?.creditsRemaining).toBe(10);
    });

    it("throws 402 when member has no credits remaining", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack = await createPackage(repos, studioId, {
        memberId,
        credits: 1,
      });
      await repos.classPacks.update(pack.id, { creditsRemaining: 0 });
      await expect(spendCreditForBooking(repos, memberId)).rejects.toThrow(HttpError);
      try {
        await spendCreditForBooking(repos, memberId);
      } catch (e) {
        if (e instanceof HttpError) {
          expect(e.status).toBe(402);
          expect(e.code).toBe("no_credits");
        }
      }
    });

    it("never deducts more than one credit", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack = await createPackage(repos, studioId, {
        memberId,
        credits: 10,
      });
      await spendCreditForBooking(repos, memberId);
      await spendCreditForBooking(repos, memberId);
      const updated = await repos.classPacks.getById(pack.id);
      expect(updated?.creditsRemaining).toBe(8);
    });

    it("never reduces creditsRemaining below 0", async () => {
      const seed = buildSeed();
      const repos = createInMemoryRepositories(seed);
      const memberId = seed.members[0].id;
      const studioId = seed.studio.id;

      const pack = await createPackage(repos, studioId, {
        memberId,
        credits: 1,
      });
      await spendCreditForBooking(repos, memberId);
      const updated = await repos.classPacks.getById(pack.id);
      expect(updated?.creditsRemaining).toBeGreaterThanOrEqual(0);
    });
  });
});
