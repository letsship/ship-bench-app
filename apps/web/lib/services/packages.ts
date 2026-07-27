import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { packPriceCents, toPackResponse, type PackResponse } from "@/lib/domain/class-packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackResponse> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(404, "not_found", "Member not found");
  }

  const pack: ClassPack = {
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: nowIso(),
    createdAt: nowIso(),
  };

  const inserted = await repos.classPacks.insert(pack);
  return toPackResponse(inserted);
}

export async function listPackages(repos: Repositories, memberId: string): Promise<PackResponse[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs.map(toPackResponse);
}

export async function refundPackage(repos: Repositories, id: string): Promise<PackResponse> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) {
    throw new HttpError(404, "not_found", "Pack not found");
  }

  const updated = await repos.classPacks.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });

  return toPackResponse(updated);
}
