// Class pack rules. A pack is a prepaid bundle of credits; bookings draw one
// credit from the oldest still-spendable pack, ignoring exhausted or refunded
// ones.

export const ALLOWED_PACK_CREDITS = [5, 10] as const;
export type PackCredits = (typeof ALLOWED_PACK_CREDITS)[number];

export const PACK_PRICE_PER_CREDIT_CENTS = 1000;

export interface SpendablePack {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

// The oldest (by purchasedAt) pack that still has a credit to spend, or null
// if every pack the member owns is exhausted or refunded.
export function pickSpendablePack<T extends SpendablePack>(packs: readonly T[]): T | null {
  const spendable = packs.filter((pack) => pack.status !== "refunded" && pack.creditsRemaining > 0);
  if (spendable.length === 0) return null;
  return spendable.reduce((oldest, pack) =>
    pack.purchasedAt.localeCompare(oldest.purchasedAt) < 0 ? pack : oldest,
  );
}
