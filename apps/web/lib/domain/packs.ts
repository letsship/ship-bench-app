// Prepaid class packs. A member buys a bundle of credits up front; each class
// they book spends one until the pack runs out. Pure decisions over minimal
// shapes so the booking flow and tests can exercise every branch.

export const PACK_CREDIT_OPTIONS = [5, 10] as const;

// Flat rate: every credit costs 1000 cents, so a pack's TOTAL price is
// credits × 1000 (5 → 5000, 10 → 10000).
export const PRICE_CENTS_PER_CREDIT = 1000;

export type PackStatus = "active" | "refunded";

export interface PackShape {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

export function packPriceCents(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

// A pack can be drawn from while it is active and has credits left. A refunded
// pack is never drawable, whatever its remaining count.
export function isDrawable(pack: { status: string; creditsRemaining: number }): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

export type PackDraw =
  { kind: "no_pack" } | { kind: "exhausted" } | { kind: "draw"; packId: string };

// Decide which pack a booking spends from. A member with no packs books as
// before; a member who owns packs but has no drawable credits is blocked; and
// otherwise the OLDEST drawable pack (by purchase date) is spent first.
export function resolvePackDraw(packs: readonly PackShape[]): PackDraw {
  if (packs.length === 0) return { kind: "no_pack" };
  const drawable = [...packs]
    .filter(isDrawable)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  if (drawable.length === 0) return { kind: "exhausted" };
  return { kind: "draw", packId: drawable[0].id };
}
