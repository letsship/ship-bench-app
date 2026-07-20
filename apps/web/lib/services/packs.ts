import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import { packPriceCents } from "@/lib/domain/packs";
import type { CreatePackInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

export async function createPack(
  repos: Repositories,
  studioId: string,
  input: CreatePackInput,
): Promise<{
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  if (member.studioId !== studioId) {
    throw new HttpError(403, "forbidden", "Member does not belong to this studio");
  }

  const packId = newId();
  const now = nowIso();
  const priceCents = packPriceCents(input.credits);

  const pack: ClassPack = {
    id: packId,
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents,
    status: "active",
    purchasedAt: now,
    createdAt: now,
  };

  await repos.classPacks.insert(pack);

  return {
    id: pack.id,
    memberId: pack.memberId,
    creditsTotal: pack.creditsTotal,
    creditsRemaining: pack.creditsRemaining,
    priceCents: pack.priceCents,
    status: pack.status,
    purchasedAt: pack.purchasedAt,
  };
}

export async function listPacks(
  repos: Repositories,
  memberId: string,
): Promise<
  Array<{
    id: string;
    creditsTotal: number;
    creditsRemaining: number;
    priceCents: number;
    status: string;
    purchasedAt: string;
  }>
> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs.map((pack) => ({
    id: pack.id,
    creditsTotal: pack.creditsTotal,
    creditsRemaining: pack.creditsRemaining,
    priceCents: pack.priceCents,
    status: pack.status,
    purchasedAt: pack.purchasedAt,
  }));
}

export async function refundPack(
  repos: Repositories,
  packId: string,
): Promise<{
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}> {
  const pack = await repos.classPacks.getById(packId);
  if (!pack) throw new HttpError(404, "not_found", "Pack not found");

  const updated = await repos.classPacks.update(packId, {
    creditsRemaining: 0,
    status: "refunded",
  });

  return {
    id: updated.id,
    creditsTotal: updated.creditsTotal,
    creditsRemaining: updated.creditsRemaining,
    priceCents: updated.priceCents,
    status: updated.status,
    purchasedAt: updated.purchasedAt,
  };
}
