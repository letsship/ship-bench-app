import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { Pack } from "@/lib/db/types";
import { packPriceCents, pickDrawablePack } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

// API response shape matching the acceptance criteria.
export interface PackView {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toView(pack: Pack): PackView {
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

/** Buy a new pack. */
export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackView> {
  const now = new Date().toISOString();
  const pack: Pack = {
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: now,
  };
  const inserted = await repos.packs.insert(pack);
  return toView(inserted);
}

/** List a member's packs, newest first. */
export async function listPackages(
  repos: Repositories,
  memberId: string,
): Promise<PackView[]> {
  const packs = await repos.packs.listByMember(memberId);
  return packs.map(toView);
}

/** Refund a pack: creditsRemaining to 0, status to refunded. */
export async function refundPackage(
  repos: Repositories,
  id: string,
): Promise<PackView> {
  const existing = await repos.packs.getById(id);
  if (!existing) throw new HttpError(404, "not_found", "Pack not found");
  const updated = await repos.packs.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });
  return toView(updated);
}

/**
 * Spend one credit from a member's oldest drawable pack.
 * Called by the bookings service after a booking is confirmed.
 * Returns the updated pack, or null if the member has no drawable pack.
 */
export async function spendCreditForMember(
  repos: Repositories,
  memberId: string,
): Promise<Pack | null> {
  const packs = await repos.packs.listByMember(memberId);
  const drawable = pickDrawablePack(packs);
  if (!drawable) return null;
  return repos.packs.update(drawable.id, { creditsRemaining: drawable.creditsRemaining - 1 });
}