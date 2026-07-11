// Class pack pricing + credit-draw rules. Flat rate: 1000 cents per credit.

export const PACK_CREDIT_OPTIONS = [5, 10] as const;
export type PackCredits = (typeof PACK_CREDIT_OPTIONS)[number];

const CENTS_PER_CREDIT = 1000;

export function packPriceCents(credits: number): number {
  return credits * CENTS_PER_CREDIT;
}

export interface DrawablePack {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

// Oldest-purchased active pack with a spare credit, or null when none can be
// drawn from (every pack is exhausted or refunded).
export function pickDrawablePack<T extends DrawablePack>(packs: readonly T[]): T | null {
  const drawable = packs.filter((pack) => pack.status === "active" && pack.creditsRemaining > 0);
  if (drawable.length === 0) return null;
  return [...drawable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
}
