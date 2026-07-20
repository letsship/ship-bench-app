import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { priceForCredits } from "@/lib/domain/packages";
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

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageResponse> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this pack");
  }

  const priceCents = priceForCredits(input.credits);
  const packId = newId();
  const now = nowIso();

  const pack = await repos.packages.insert({
    id: packId,
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents,
    status: "active",
    purchasedAt: now,
    createdAt: now,
  });

  return toPackageResponse(pack);
}

export async function listPackages(
  repos: Repositories,
  memberId: string,
): Promise<PackageResponse[]> {
  const packs = await repos.packages.listByMember(memberId);
  return packs.map(toPackageResponse);
}

export async function refundPackage(repos: Repositories, id: string): Promise<PackageResponse> {
  const pack = await repos.packages.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Pack not found");

  const refunded = await repos.packages.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });

  return toPackageResponse(refunded);
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
