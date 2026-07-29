import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { priceForCredits } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

// Class pack sales: create a prepaid credit bundle for a member, list a
// member's packs, and refund a pack (voiding its remaining credits).

export interface PackageResponse {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export interface CreatedPackageResponse extends PackageResponse {
  memberId: string;
}

function toPackageResponse(pack: ClassPack): PackageResponse {
  return {
    id: pack.id,
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
): Promise<CreatedPackageResponse> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this package");
  }
  const purchasedAt = new Date().toISOString();
  const pack = await repos.classPacks.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: priceForCredits(input.credits),
    status: "active",
    purchasedAt,
    createdAt: purchasedAt,
  });
  return { ...toPackageResponse(pack), memberId: pack.memberId };
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
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  const refunded = await repos.classPacks.update(id, { creditsRemaining: 0, status: "refunded" });
  return toPackageResponse(refunded);
}
