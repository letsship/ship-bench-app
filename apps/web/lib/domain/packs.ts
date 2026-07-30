// Prepaid class packs. A member buys a bundle of credits up front and every
// confirmed booking spends one. Pure rules only — pricing and which pack a
// booking draws from — with no framework, database, or request concerns.
//
// Status vocabulary: 'active' | 'refunded'. "Exhausted" is DERIVED (an active
// pack with creditsRemaining === 0), never stored, so there is exactly one
// place that decides whether a pack can still be drawn from: isDrawable().

export const PACK_CREDIT_OPTIONS = [5, 10] as const;

export type PackCredits = (typeof PACK_CREDIT_OPTIONS)[number];

export type PackStatus = "active" | "refunded";

// 1000 cents per credit. priceForCredits returns the pack's TOTAL price.
export const PRICE_CENTS_PER_CREDIT = 1000;

export function priceForCredits(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

export interface DrawablePack {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

// A pack can be drawn from while it is active and still has credits. Refunded
// packs are voided at refund time and are never drawn from again.
export function isDrawable(pack: DrawablePack): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

// Oldest pack first, so members burn down what they bought earliest. Ties on
// purchasedAt fall back to id for a deterministic pick.
export function pickDrawablePack<T extends DrawablePack>(packs: readonly T[]): T | null {
  const drawable = packs.filter(isDrawable);
  if (drawable.length === 0) return null;
  return drawable.reduce((oldest, pack) =>
    pack.purchasedAt === oldest.purchasedAt
      ? pack.id < oldest.id
        ? pack
        : oldest
      : pack.purchasedAt < oldest.purchasedAt
        ? pack
        : oldest,
  );
}
