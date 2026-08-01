// Class pack pricing + credit-draw selection. Pure decisions over minimal
// shapes so the booking service and tests can exercise every branch.

export const PACK_CREDIT_OPTIONS = [5, 10] as const;

export type PackCredits = (typeof PACK_CREDIT_OPTIONS)[number];

const PRICE_PER_CREDIT_CENTS = 1000;

// Total price of a pack (NOT the per-credit rate): 1000 cents per credit.
export function packPriceCents(credits: number): number {
  return credits * PRICE_PER_CREDIT_CENTS;
}

export interface DrawablePack {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

export type PackDraw =
  | { kind: "none" }
  | { kind: "exhausted" }
  | { kind: "draw"; packId: string; creditsRemaining: number };

// Decide where a booking's credit comes from. A member who never bought a pack
// books as before ('none'); once they own packs, bookings must draw a credit
// from the oldest active pack with credits left, and when every pack is used up
// or refunded the booking is stopped ('exhausted').
export function resolvePackDraw(packs: readonly DrawablePack[]): PackDraw {
  if (packs.length === 0) return { kind: "none" };
  const drawable = packs
    .filter((pack) => pack.status === "active" && pack.creditsRemaining > 0)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  if (drawable.length === 0) return { kind: "exhausted" };
  return { kind: "draw", packId: drawable[0].id, creditsRemaining: drawable[0].creditsRemaining };
}
