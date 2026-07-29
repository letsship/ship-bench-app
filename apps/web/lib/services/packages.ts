import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { memberRequiresPack, packPriceCents, selectPackToDraw } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

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

function toView(pack: ClassPack): PackageView {
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
  return {
    id: pack.id,
    creditsTotal: pack.creditsTotal,
    creditsRemaining: pack.creditsRemaining,
    priceCents: pack.priceCents,
    status: pack.status,
    purchasedAt: pack.purchasedAt,
  };
}

// Buy a pack for a member. Validates the member exists and belongs to the
// studio, then inserts a fully-formed active pack priced at credits × 1000.
export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageView> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this pack");
  }
  const now = nowIso();
  const pack = await repos.packages.insert({
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

// List a member's packs newest-first (by purchasedAt, then createdAt).
export async function listPackages(
  repos: Repositories,
  memberId: string,
): Promise<PackageListItem[]> {
  const packs = await repos.packages.listByMember(memberId);
  return packs
    .sort(
      (a, b) =>
        b.purchasedAt.localeCompare(a.purchasedAt) || b.createdAt.localeCompare(a.createdAt),
    )
    .map(toListItem);
}

// Refund a pack: void its remaining credits and mark it refunded so it is never
// drawn from again. 404 if the pack does not exist.
export async function refundPackage(
  repos: Repositories,
  id: string,
): Promise<PackageListItem> {
  const pack = await repos.packages.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Pack not found");
  const refunded = await repos.packages.update(id, { creditsRemaining: 0, status: "refunded" });
  return toListItem(refunded);
}

// Spend one credit from the member's oldest drawable pack as part of a booking.
// A member who has never bought a pack is unaffected ({ drawn: false }). Once a
// member owns any pack, every booking MUST come from a pack — if none is
// drawable (all exhausted or refunded), reject with 402 pack_exhausted.
export async function drawCreditForBooking(
  repos: Repositories,
  memberId: string,
): Promise<{ drawn: boolean }> {
  const packs = await repos.packages.listByMember(memberId);
  if (!memberRequiresPack(packs)) return { drawn: false };
  const drawable = selectPackToDraw(packs);
  if (!drawable) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member has no class-pack credits left. Buy another pack to book.",
    );
  }
  await repos.packages.update(drawable.id, { creditsRemaining: drawable.creditsRemaining - 1 });
  return { drawn: true };
}
