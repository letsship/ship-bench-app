import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { memberHasAnyPack, packPriceCents, selectPackToSpend } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

export interface PackageResponse {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toPackageResponse(pack: ClassPack): PackageResponse {
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
): Promise<PackageResponse> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(
      400,
      "invalid_member",
      "Member not found or does not belong to this studio",
    );
  }

  const priceCents = packPriceCents(input.credits);
  const pack: ClassPack = {
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents,
    status: "active",
    purchasedAt: nowIso(),
  };

  const created = await repos.classPacks.insert(pack);
  return toPackageResponse(created);
}

export async function listPackages(
  repos: Repositories,
  memberId: string,
): Promise<PackageResponse[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs.map(toPackageResponse);
}

export async function refundPackage(repos: Repositories, id: string): Promise<PackageResponse> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Package not found");

  const updated = await repos.classPacks.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });
  return toPackageResponse(updated);
}

export async function drawCreditForMember(repos: Repositories, memberId: string): Promise<void> {
  const packs = await repos.classPacks.listByMember(memberId);

  // No pack = member books as usual (unchanged).
  if (!memberHasAnyPack(packs)) return;

  // Member has pack(s). Find one with credits.
  const packToSpend = selectPackToSpend(packs);
  if (!packToSpend) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "All class packs exhausted; please purchase another",
    );
  }

  // Spend one credit from the oldest active pack.
  await repos.classPacks.update(packToSpend.id, {
    creditsRemaining: packToSpend.creditsRemaining - 1,
  });
}
