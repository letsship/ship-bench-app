import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import {
  ownsAnyPack,
  packPriceCents,
  pickSpendablePack,
  voidRemaining,
} from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

// Class-pack service: buying, listing, and refunding prepaid credit packs,
// plus the booking hook that decides which pack (if any) a booking draws from.

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

const toDto = (pack: ClassPack): PackageDto => ({
  id: pack.id,
  memberId: pack.memberId,
  creditsTotal: pack.creditsTotal,
  creditsRemaining: pack.creditsRemaining,
  priceCents: pack.priceCents,
  status: pack.status,
  purchasedAt: pack.purchasedAt,
});

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageDto> {
  const pack = await repos.classPacks.insert({
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: nowIso(),
    createdAt: nowIso(),
  });
  return toDto(pack);
}

export async function listPackages(repos: Repositories, memberId: string): Promise<PackageDto[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs
    .slice()
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))
    .map(toDto);
}

export async function refundPackage(repos: Repositories, id: string): Promise<PackageDto> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  const updated = await repos.classPacks.update(id, voidRemaining(pack));
  return toDto(updated);
}

// Which pack should a booking draw from? null means the member owns no packs
// and books exactly as before (no credit involved). When the member owns packs
// but none are spendable, the booking must stop with 402 pack_exhausted.
export async function drawCreditForBooking(
  repos: Repositories,
  memberId: string,
): Promise<string | null> {
  const packs = await repos.classPacks.listByMember(memberId);
  if (!ownsAnyPack(packs)) return null;
  const spendable = pickSpendablePack(packs);
  if (!spendable) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member has no class credits left — buy another pack",
    );
  }
  return spendable.id;
}
