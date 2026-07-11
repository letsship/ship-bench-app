// Class-pack pricing + draw-selection rules. A pack is a prepaid bundle of
// booking credits; bookings silently draw from the member's oldest active
// pack until it runs out.

export const PACK_CREDIT_OPTIONS = [5, 10] as const;
export type PackCreditOption = (typeof PACK_CREDIT_OPTIONS)[number];

const CENTS_PER_CREDIT = 1000;

export function computePackPriceCents(credits: number): number {
  return credits * CENTS_PER_CREDIT;
}

export interface DrawablePack {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

// The oldest active pack with credits left, or null if the member has none to
// draw from (no packs, or every pack is exhausted/refunded).
export function selectDrawablePack<T extends DrawablePack>(packs: readonly T[]): T | null {
  const eligible = packs.filter((pack) => pack.status === "active" && pack.creditsRemaining > 0);
  if (eligible.length === 0) return null;
  return eligible.reduce((oldest, pack) => (pack.purchasedAt < oldest.purchasedAt ? pack : oldest));
}
