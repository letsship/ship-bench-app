// Class pack credit rules. Pure decisions over a minimal shape, mirroring
// booking-rules.ts's pickWaitlistPromotion: takes just the fields it needs and
// returns an id, leaving the caller to look up the full row.

export const CREDIT_PRICE_CENTS = 1000;

export interface PackCredit {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

// The pack a booking should draw from: the oldest active pack that still has a
// credit to spend, or null when the member has none usable.
export function pickPackToSpendFrom(packs: readonly PackCredit[]): string | null {
  const usable = packs.filter((pack) => pack.status === "active" && pack.creditsRemaining > 0);
  if (usable.length === 0) return null;
  return [...usable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0].id;
}
