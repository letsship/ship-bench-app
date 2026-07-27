// Prepaid class pack rules: pricing and which pack a booking draws from. Pure
// business logic — no framework, database, or request concerns.

export const ALLOWED_CREDITS = [5, 10] as const;
export type AllowedCredits = (typeof ALLOWED_CREDITS)[number];

const PRICE_CENTS_PER_CREDIT = 1000;

// Total price for a pack of this many credits (NOT the per-credit rate).
export function creditsToPriceCents(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

export interface DrawablePack {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

// The pack a booking should draw a credit from: the oldest active pack that
// still has credits, skipping exhausted and refunded packs. Null when the
// member has no drawable pack left.
export function pickDrawablePack<T extends DrawablePack>(packs: readonly T[]): T | null {
  const drawable = packs.filter((pack) => pack.status === "active" && pack.creditsRemaining > 0);
  if (drawable.length === 0) return null;
  return [...drawable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
}

// Refunding a pack voids its remaining credits so it can never be drawn from
// again.
export function voidPackForRefund(): { creditsRemaining: number; status: string } {
  return { creditsRemaining: 0, status: "refunded" };
}
