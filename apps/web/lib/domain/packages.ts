// Pure class-pack rules, free of framework, database, and request concerns.
// A "class pack" is a prepaid bundle of credits: a member buys one (5 or 10
// credits), and each confirmed booking spends one credit from their oldest
// active pack until it runs out. Refunding a pack voids its remaining credits
// so they can no longer be drawn from. See lib/services/packages.ts for the
// composition of these rules with the repositories.

import type { ClassPack } from "@/lib/db/types";

export const PRICE_CENTS_PER_CREDIT = 1000;

export const VALID_PACK_CREDITS = [5, 10] as const;

export type PackCredits = (typeof VALID_PACK_CREDITS)[number];

// The pack's TOTAL price — credits × the per-credit rate — not the per-credit
// rate itself. A 5-credit pack is 5000 cents; a 10-credit pack is 10000 cents.
export function packPriceCents(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

// Whether a pack is still drawable: active and holding at least one credit.
export function isDrawable(pack: ClassPack): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

// The oldest pack (earliest purchasedAt) the next booking should draw from, or
// null when the member has no drawable pack left. Ties on purchasedAt break on
// createdAt so seed/runtime order is stable.
export function selectPackToDraw(packs: readonly ClassPack[]): ClassPack | null {
  const drawable = packs
    .filter(isDrawable)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.createdAt.localeCompare(b.createdAt));
  return drawable[0] ?? null;
}

// A member who has EVER bought a pack must pay for every subsequent booking
// with a credit; a member who never bought one books exactly as today. Refunded
// packs still count — once you are in the pack system, you stay in it.
export function memberRequiresPack(packs: readonly ClassPack[]): boolean {
  return packs.length > 0;
}
