// Class pack rules. A pack is a prepaid bundle of credits; each confirmed
// booking spends one credit from the member's oldest drawable pack. Pure,
// framework-free — no database, request, or email concerns.

export const PACK_PRICE_PER_CREDIT_CENTS = 1000;

export const ALLOWED_PACK_CREDITS = [5, 10] as const;

export type AllowedPackCredits = (typeof ALLOWED_PACK_CREDITS)[number];

// A pack's priceCents is its TOTAL price, not the per-credit rate.
export function packPriceCents(credits: number): number {
  return credits * PACK_PRICE_PER_CREDIT_CENTS;
}

export interface DrawablePack {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

// The oldest active pack that still has a credit to spend, or null when the
// member owns no drawable pack (never bought one, or every pack is spent /
// refunded).
export function pickDrawablePack<T extends DrawablePack>(packs: readonly T[]): T | null {
  const drawable = packs.filter((pack) => pack.status === "active" && pack.creditsRemaining > 0);
  if (drawable.length === 0) return null;
  return [...drawable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
}

// Whether the member has ever bought a pack — once true, bookings must draw
// from a pack rather than proceeding unmetered.
export function memberOwnsAnyPack(packs: readonly unknown[]): boolean {
  return packs.length > 0;
}
