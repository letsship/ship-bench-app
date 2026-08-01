import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { packPriceCents } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export interface PackView {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toView(pack: ClassPack): PackView {
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

export async function createPack(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackView> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this pack");
  }

  const now = new Date().toISOString();
  const pack = await repos.packs.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: now,
    createdAt: now,
  });
  return toView(pack);
}

// Newest first, per the repo contract.
export async function listPacksByMember(
  repos: Repositories,
  memberId: string,
): Promise<PackView[]> {
  const packs = await repos.packs.listByMember(memberId);
  return packs.map(toView);
}

// Refund voids the remaining credits: they can never be spent again.
export async function refundPack(repos: Repositories, id: string): Promise<PackView> {
  const pack = await repos.packs.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  const updated = await repos.packs.update(id, { creditsRemaining: 0, status: "refunded" });
  return toView(updated);
}
