import { describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import { buildSeed } from "@/lib/db/seed-data";
import type { Pack } from "@/lib/db/types";
import {
  createPackage,
  drawCreditForBooking,
  listPackages,
  refundPackage,
} from "./packages";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function pack(id: string, memberId: string, purchasedAt: string, creditsRemaining = 5): Pack {
  return {
    id,
    studioId: "s1",
    memberId,
    creditsTotal: 5,
    creditsRemaining,
    priceCents: 5000,
    status: creditsRemaining === 0 ? "exhausted" : "active",
    purchasedAt,
    createdAt: purchasedAt,
  };
}

describe("packages service", () => {
  it("creates five- and ten-credit packs at their total prices", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const memberId = (await repos.members.listByStudio(studioId))[0].id;

    const five = await createPackage(repos, studioId, { memberId, credits: 5 });
    const ten = await createPackage(repos, studioId, { memberId, credits: 10 });

    expect(five).toMatchObject({ creditsTotal: 5, creditsRemaining: 5, priceCents: 5000, status: "active" });
    expect(ten).toMatchObject({ creditsTotal: 10, creditsRemaining: 10, priceCents: 10000, status: "active" });
  });

  it("lists a member's packs newest first", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const memberId = (await repos.members.listByStudio(studioId))[0].id;
    await repos.packs.insert(pack("old", memberId, "2026-03-01T00:00:00.000Z"));
    await repos.packs.insert(pack("new", memberId, "2026-03-02T00:00:00.000Z"));

    await expect(listPackages(repos, memberId)).resolves.toMatchObject([{ id: "new" }, { id: "old" }]);
  });

  it("refunds remaining credits and never draws from the refunded pack", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const member = (await repos.members.listByStudio(studioId))[0];
    await repos.packs.insert(pack("p1", member.id, "2026-03-01T00:00:00.000Z"));

    await expect(refundPackage(repos, "p1")).resolves.toMatchObject({
      creditsRemaining: 0,
      status: "refunded",
    });
    await expect(drawCreditForBooking(repos, member)).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
  });

  it("draws the oldest active pack first and gates exhausted members", async () => {
    const repos = createInMemoryRepositories(buildSeed(NOW));
    const studioId = (await repos.studios.getFirst())?.id ?? "";
    const member = (await repos.members.listByStudio(studioId))[0];
    await repos.packs.insert(pack("old", member.id, "2026-03-01T00:00:00.000Z", 1));
    await repos.packs.insert(pack("new", member.id, "2026-03-02T00:00:00.000Z", 5));

    await drawCreditForBooking(repos, member);
    await expect(repos.packs.getById("old")).resolves.toMatchObject({
      creditsRemaining: 0,
      status: "exhausted",
    });
    await expect(repos.packs.getById("new")).resolves.toMatchObject({ creditsRemaining: 5 });
    await expect(drawCreditForBooking(repos, { ...member, id: "no-pack" })).resolves.toBeUndefined();
  });
});
