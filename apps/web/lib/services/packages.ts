import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { hasEverPurchased, packPriceCents, selectDrawablePack } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

export async function listPackages(repos: Repositories, memberId: string): Promise<ClassPack[]> {
  return repos.classPacks.listByMember(memberId);
}

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<ClassPack> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");

  const pack: ClassPack = {
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: nowIso(),
  };

  return repos.classPacks.insert(pack);
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPack> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Pack not found");

  return repos.classPacks.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });
}

export async function drawCreditForMember(
  repos: Repositories,
  memberId: string,
): Promise<ClassPack | null> {
  const packs = await repos.classPacks.listByMember(memberId);

  if (!hasEverPurchased(packs)) {
    return null;
  }

  const drawablePack = selectDrawablePack(packs);
  if (!drawablePack) {
    throw new HttpError(402, "pack_exhausted", "No credits remaining in any pack");
  }

  return drawablePack;
}
