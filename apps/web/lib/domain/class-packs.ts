// Class pack rules: the two sellable sizes, the flat per-credit price, and
// which pack a booking draws from. No framework or database imports.

export const PACK_SIZES = [5, 10] as const;
export type PackSize = (typeof PACK_SIZES)[number];

export const PRICE_PER_CREDIT_CENTS = 1000;

export interface DrawablePack {
  id: string;
  purchasedAt: string;
  creditsRemaining: number;
}

// The oldest pack (by purchasedAt) that still has a credit to spend, or null
// if every pack is exhausted.
export function pickPackToDraw(packs: readonly DrawablePack[]): string | null {
  const eligible = packs.filter((pack) => pack.creditsRemaining > 0);
  if (eligible.length === 0) return null;
  return eligible.reduce((oldest, pack) => (pack.purchasedAt < oldest.purchasedAt ? pack : oldest))
    .id;
}
