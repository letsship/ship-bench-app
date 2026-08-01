import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "@/lib/db/repos/fakes";
import type { Repositories } from "@/lib/db/repos/types";
import { buildSeed } from "@/lib/db/seed-data";
import type { ClassPack } from "@/lib/db/types";
import { createPack, drawCreditForPack, listPacks, refundPack } from "./packs";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("class pack service", () => {
  let repos: Repositories;
  let studioId: string;
  let memberId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories(buildSeed(NOW));
    studioId = (await repos.studios.getFirst())?.id ?? "";
    memberId = (await repos.members.listByStudio(studioId))[0].id;
  });

  const pack = (over: Partial<ClassPack> = {}): ClassPack => ({
    id: "pack-1",
    studioId,
    memberId,
    creditsTotal: 5,
    creditsRemaining: 5,
    priceCents: 5000,
    status: "active",
    purchasedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });

  it("creates a correctly priced active pack", async () => {
    const created = await createPack(repos, studioId, { memberId, credits: 10 });

    expect(created).toMatchObject({
      memberId,
      creditsTotal: 10,
      creditsRemaining: 10,
      priceCents: 10000,
      status: "active",
    });
  });

  it("lists packs newest first", async () => {
    await repos.packs.insert(pack());
    await repos.packs.insert(
      pack({ id: "pack-2", purchasedAt: "2026-02-01T00:00:00.000Z" }),
    );

    expect((await listPacks(repos, memberId)).map((item) => item.id)).toEqual([
      "pack-2",
      "pack-1",
    ]);
  });

  it("refunds a pack and voids its remaining credits", async () => {
    await repos.packs.insert(pack());

    await expect(refundPack(repos, "pack-1")).resolves.toMatchObject({
      creditsRemaining: 0,
      status: "refunded",
    });
  });

  it("returns null when the member has never owned a pack", async () => {
    await expect(drawCreditForPack(repos, memberId)).resolves.toBeNull();
  });

  it("draws from the oldest available pack", async () => {
    await repos.packs.insert(pack({ creditsRemaining: 2 }));
    await repos.packs.insert(
      pack({ id: "pack-2", creditsRemaining: 5, purchasedAt: "2026-02-01T00:00:00.000Z" }),
    );

    await drawCreditForPack(repos, memberId);

    expect((await repos.packs.getById("pack-1"))?.creditsRemaining).toBe(1);
    expect((await repos.packs.getById("pack-2"))?.creditsRemaining).toBe(5);
  });

  it("rejects drawing when every owned pack is exhausted or refunded", async () => {
    await repos.packs.insert(pack({ creditsRemaining: 0 }));
    await repos.packs.insert(
      pack({ id: "pack-2", status: "refunded", purchasedAt: "2026-02-01T00:00:00.000Z" }),
    );

    await expect(drawCreditForPack(repos, memberId)).rejects.toMatchObject({
      status: 402,
      code: "pack_exhausted",
    });
  });
});
