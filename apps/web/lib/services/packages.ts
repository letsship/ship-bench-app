import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { Package } from "@/lib/db/types";
import { packPriceCents, resolvePackDraw } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export interface PackageView {
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

function toView(pack: Package): PackageView {
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

export async function buyPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageView> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(404, "not_found", "Member not found");
  }

  const purchasedAt = new Date().toISOString();
  const pack = await repos.packages.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt,
    createdAt: purchasedAt,
  });
  return toView(pack);
}

// A member's packs, newest first (the repos already order by purchase date).
export async function listPackages(
  repos: Repositories,
  memberId: string,
): Promise<PackageListItem[]> {
  const packs = await repos.packages.listByMember(memberId);
  return packs.map((pack) => ({
    id: pack.id,
    creditsTotal: pack.creditsTotal,
    creditsRemaining: pack.creditsRemaining,
    priceCents: pack.priceCents,
    status: pack.status,
    purchasedAt: pack.purchasedAt,
  }));
}

// Refunding voids whatever credits are left, so the pack can never be drawn
// from again.
export async function refundPackage(repos: Repositories, id: string): Promise<PackageView> {
  const pack = await repos.packages.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Package not found");
  const refunded = await repos.packages.update(id, { creditsRemaining: 0, status: "refunded" });
  return toView(refunded);
}

// Spend one prepaid credit for a booking. A member who never bought a pack is
// unaffected; a pack owner with no drawable credits is blocked with 402; and
// otherwise the oldest active pack loses one credit.
export async function spendCreditForMember(repos: Repositories, memberId: string): Promise<void> {
  const packs = await repos.packages.listByMember(memberId);
  const draw = resolvePackDraw(packs);
  if (draw.kind === "no_pack") return;
  if (draw.kind === "exhausted") {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member's class packs are used up — buy another pack to book",
    );
  }
  const pack = await repos.packages.getById(draw.packId);
  if (!pack) throw new HttpError(404, "not_found", "Package not found");
  await repos.packages.update(pack.id, { creditsRemaining: pack.creditsRemaining - 1 });
}
