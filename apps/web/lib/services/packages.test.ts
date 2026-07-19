import { describe, it, expect, beforeEach } from "vitest";
import type { CreatePackageInput } from "@/lib/validation";
import { buildSeed } from "@/lib/db/seed-data";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buyPackage, listPackages, refundPackage, drawCreditForBooking } from "./packages";
import { createBooking } from "./bookings";
import type { NotificationProvider } from "@/lib/notifications/types";

const mockProvider: NotificationProvider = {
  send: async () => ({ messageId: "test" }),
};

describe("packages service", () => {
  let repos: Repositories;
  const seed = buildSeed();

  beforeEach(() => {
    repos = createInMemoryRepositories(seed);
  });

  describe("buyPackage", () => {
    it("creates an active pack with correct credits and pricing", async () => {
      const member = seed.members[0];
      const input: CreatePackageInput = {
        memberId: member.id,
        credits: 5,
      };
      const pack = await buyPackage(repos, seed.studio.id, input);

      expect(pack.creditsTotal).toBe(5);
      expect(pack.creditsRemaining).toBe(5);
      expect(pack.priceCents).toBe(5000);
      expect(pack.status).toBe("active");
      expect(pack.memberId).toBe(member.id);
      expect(pack.studioId).toBe(seed.studio.id);
    });

    it("creates a 10-credit pack with correct pricing", async () => {
      const member = seed.members[0];
      const input: CreatePackageInput = {
        memberId: member.id,
        credits: 10,
      };
      const pack = await buyPackage(repos, seed.studio.id, input);

      expect(pack.creditsTotal).toBe(10);
      expect(pack.creditsRemaining).toBe(10);
      expect(pack.priceCents).toBe(10000);
      expect(pack.status).toBe("active");
    });

    it("rejects unknown member", async () => {
      const input: CreatePackageInput = {
        memberId: "unknown",
        credits: 5,
      };
      await expect(buyPackage(repos, seed.studio.id, input)).rejects.toThrow("Unknown member");
    });
  });

  describe("listPackages", () => {
    it("returns empty list for member with no packs", async () => {
      const member = seed.members[0];
      const packs = await listPackages(repos, member.id);
      expect(packs).toEqual([]);
    });

    it("returns packs for member, newest first", async () => {
      const member = seed.members[0];
      const now = new Date();
      const pack1 = {
        memberId: member.id,
        credits: 5,
      };
      const pack2 = {
        memberId: member.id,
        credits: 10,
      };
      const p1 = await buyPackage(repos, seed.studio.id, pack1);
      const p2Obj = await buyPackage(repos, seed.studio.id, pack2);
      const p2 = { ...p2Obj, purchasedAt: new Date(now.getTime() + 1000).toISOString() };
      await repos.classPacks.update(p2.id, { purchasedAt: p2.purchasedAt });

      const packs = await listPackages(repos, member.id);
      expect(packs).toHaveLength(2);
      expect(packs[0].id).toBe(p2.id);
      expect(packs[1].id).toBe(p1.id);
    });
  });

  describe("refundPackage", () => {
    it("refunds a pack and voids remaining credits", async () => {
      const member = seed.members[0];
      const pack = await buyPackage(repos, seed.studio.id, {
        memberId: member.id,
        credits: 5,
      });

      const refunded = await refundPackage(repos, pack.id);
      expect(refunded.status).toBe("refunded");
      expect(refunded.creditsRemaining).toBe(0);
    });

    it("rejects unknown pack", async () => {
      await expect(refundPackage(repos, "unknown")).rejects.toThrow("Package not found");
    });
  });

  describe("drawCreditForBooking", () => {
    it("does nothing if member has no packs", async () => {
      const member = seed.members[0];
      await expect(drawCreditForBooking(repos, member.id)).resolves.toBeUndefined();
    });

    it("spends one credit from the oldest active pack", async () => {
      const member = seed.members[0];
      const pack1 = await buyPackage(repos, seed.studio.id, {
        memberId: member.id,
        credits: 5,
      });
      await new Promise((resolve) => setTimeout(resolve, 1));
      const pack2 = await buyPackage(repos, seed.studio.id, {
        memberId: member.id,
        credits: 10,
      });

      await drawCreditForBooking(repos, member.id);

      const updated1 = await repos.classPacks.getById(pack1.id);
      const updated2 = await repos.classPacks.getById(pack2.id);

      expect(updated1?.creditsRemaining).toBe(4);
      expect(updated2?.creditsRemaining).toBe(10);
    });

    it("throws 402 pack_exhausted when member has packs but no drawable credits", async () => {
      const member = seed.members[0];
      const _pack = await buyPackage(repos, seed.studio.id, {
        memberId: member.id,
        credits: 1,
      });

      await drawCreditForBooking(repos, member.id);

      try {
        await drawCreditForBooking(repos, member.id);
        throw new Error("Expected error to be thrown");
      } catch (err: unknown) {
        expect((err as Record<string, string>).code).toBe("pack_exhausted");
      }
    });

    it("does not draw from refunded packs", async () => {
      const member = seed.members[0];
      const pack = await buyPackage(repos, seed.studio.id, {
        memberId: member.id,
        credits: 5,
      });

      await refundPackage(repos, pack.id);

      try {
        await drawCreditForBooking(repos, member.id);
        throw new Error("Expected error to be thrown");
      } catch (err: unknown) {
        expect((err as Record<string, string>).code).toBe("pack_exhausted");
      }
    });
  });

  describe("bookings with packs", () => {
    it("automatically draws a credit when booking", async () => {
      const member = seed.members[0];
      const now = new Date();
      const futureSession = seed.sessions.find((s) => {
        if (new Date(s.startsAt).getTime() <= now.getTime()) return false;
        const memberBooking = seed.bookings.find(
          (b) => b.sessionId === s.id && b.memberId === member.id,
        );
        return !memberBooking;
      });
      if (!futureSession) throw new Error("No available future sessions for member");

      const pack = await buyPackage(repos, seed.studio.id, {
        memberId: member.id,
        credits: 5,
      });

      await createBooking(repos, mockProvider, {
        sessionId: futureSession.id,
        memberId: member.id,
      });

      const updated = await repos.classPacks.getById(pack.id);
      expect(updated?.creditsRemaining).toBe(4);
    });

    it("rejects booking with pack_exhausted error when no credits left", async () => {
      const member = seed.members[0];
      const now = new Date();
      const futureSessions = seed.sessions.filter((s) => {
        if (new Date(s.startsAt).getTime() <= now.getTime()) return false;
        const memberBooking = seed.bookings.find(
          (b) => b.sessionId === s.id && b.memberId === member.id,
        );
        return !memberBooking;
      });
      if (futureSessions.length < 2) throw new Error("Not enough available future sessions");

      const _pack = await buyPackage(repos, seed.studio.id, {
        memberId: member.id,
        credits: 1,
      });

      await createBooking(repos, mockProvider, {
        sessionId: futureSessions[0].id,
        memberId: member.id,
      });

      try {
        await createBooking(repos, mockProvider, {
          sessionId: futureSessions[1].id,
          memberId: member.id,
        });
        throw new Error("Expected error to be thrown");
      } catch (err: unknown) {
        expect((err as Record<string, string>).code).toBe("pack_exhausted");
      }
    });

    it("does not spend credit on duplicate booking (409 already_booked)", async () => {
      const member = seed.members[0];
      const now = new Date();
      const futureSession = seed.sessions.find((s) => {
        if (new Date(s.startsAt).getTime() <= now.getTime()) return false;
        const memberBooking = seed.bookings.find(
          (b) => b.sessionId === s.id && b.memberId === member.id,
        );
        return !memberBooking;
      });
      if (!futureSession) throw new Error("No available future sessions for member");

      const pack = await buyPackage(repos, seed.studio.id, {
        memberId: member.id,
        credits: 2,
      });

      await createBooking(repos, mockProvider, {
        sessionId: futureSession.id,
        memberId: member.id,
      });

      const updated1 = await repos.classPacks.getById(pack.id);
      expect(updated1?.creditsRemaining).toBe(1);

      await expect(
        createBooking(repos, mockProvider, {
          sessionId: futureSession.id,
          memberId: member.id,
        }),
      ).rejects.toThrow("already");

      const updated2 = await repos.classPacks.getById(pack.id);
      expect(updated2?.creditsRemaining).toBe(1);
    });
  });
});
