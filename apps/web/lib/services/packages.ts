import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { packPriceCents, pickDrawablePack } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export interface PackageResponse {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export interface PackageListItem {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toResponse(pack: ClassPack): PackageResponse {
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

function toListItem(pack: ClassPack): PackageListItem {
  const { memberId: _memberId, studioId: _studioId, ...rest } = pack;
  return rest;
}

export async function createPack(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageResponse> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this pack");
  }

  const pack = await repos.packs.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
  return toResponse(pack);
}

export async function listPacks(repos: Repositories, memberId: string): Promise<PackageListItem[]> {
  const packs = await repos.packs.listByMember(memberId);
  return packs.map(toListItem);
}

export async function refundPack(repos: Repositories, id: string): Promise<PackageResponse> {
  const pack = await repos.packs.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  const refunded = await repos.packs.update(id, { creditsRemaining: 0, status: "refunded" });
  return toResponse(refunded);
}

// Spend one credit from the member's oldest drawable pack, called only once a
// booking is certain to be created. A member who has never bought a pack is
// unaffected; a member who owns packs but has none left to draw throws 402.
export async function spendMemberCredit(repos: Repositories, memberId: string): Promise<void> {
  const packs = await repos.packs.listByMember(memberId);
  if (packs.length === 0) return;

  const drawable = pickDrawablePack(packs);
  if (!drawable) {
    throw new HttpError(402, "pack_exhausted", "This member has no class pack credits left");
  }

  await repos.packs.update(drawable.id, { creditsRemaining: drawable.creditsRemaining - 1 });
}
