import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { memberOwnsAnyPack, pickDrawablePack, priceForCredits } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

// The pack fields exposed by the API (no internal studioId/createdAt leak).
export interface PackageRow {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

// List responses are scoped by memberId, so each item omits the redundant id.
export interface PackageListItem {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toRow(pack: ClassPack): PackageRow {
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

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageRow> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this class pack");
  }
  const purchasedAt = nowIso();
  const pack = await repos.packages.insert({
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
  return toRow(pack);
}

export async function listPackages(
  repos: Repositories,
  memberId: string,
): Promise<PackageListItem[]> {
  const packs = await repos.packages.listByMember(memberId);
  return packs.map(toListItem);
}

// Idempotent refund: void any remaining credits and flip status to refunded.
export async function refundPackage(repos: Repositories, id: string): Promise<PackageRow> {
  const pack = await repos.packages.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  const refunded = await repos.packages.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });
  return toRow(refunded);
}

// Resolve the pack a booking should charge for a member. Returns null when the
// member has never bought a pack (book unchanged); throws 402 pack_exhausted
// when they own packs but none are drawable; otherwise returns the oldest
// active pack with credits remaining. The caller spends the credit after the
// booking is persisted so a successful booking always pairs with a spent one.
export async function drawCreditForMember(
  repos: Repositories,
  memberId: string,
): Promise<ClassPack | null> {
  const packs = await repos.packages.listByMember(memberId);
  if (!memberOwnsAnyPack(packs)) return null;
  const drawable = pickDrawablePack(packs);
  if (!drawable) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member has no class-pack credits left; buy another pack to book",
    );
  }
  return drawable;
}
