import { newId } from "@/lib/db/ids";
import type { ClassPack } from "@/lib/db/types";
import type { Repositories } from "@/lib/db/repos/types";
import { drawFromPack, packPriceCents, pickDrawablePack } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

export interface PackageDto {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toPackageDto(pack: ClassPack): PackageDto {
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

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageDto> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  if (member.studioId !== studioId) {
    throw new HttpError(403, "forbidden", "Member does not belong to this studio");
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

  const created = await repos.classPacks.insert(pack);
  return toPackageDto(created);
}

export async function listPackages(repos: Repositories, memberId: string): Promise<PackageDto[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs.map(toPackageDto);
}

export async function refundPackage(repos: Repositories, id: string): Promise<PackageDto> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Package not found");

  const updated = await repos.classPacks.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });
  return toPackageDto(updated);
}

export async function drawCreditForBooking(repos: Repositories, memberId: string): Promise<void> {
  const packs = await repos.classPacks.listByMember(memberId);

  if (packs.length === 0) return;

  const drawablePack = pickDrawablePack(packs);
  if (!drawablePack) {
    throw new HttpError(402, "pack_exhausted", "No available credits in your packs");
  }

  const patch = drawFromPack(drawablePack);
  await repos.classPacks.update(drawablePack.id, patch);
}
