// Pure class-pack rules. A class pack is a prepaid bundle of credits: each
// booking spends one credit until the pack runs out, then the member buys
// another. No framework, database, email, or request imports here.

export const PRICE_CENTS_PER_CREDIT = 1000;
export const ALLOWED_PACK_CREDITS = [5, 10] as const;

export type PackStatus = "active" | "refunded";

export interface PackLike {
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

export function packPriceCents(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

// Once a member has bought any pack (active, exhausted, or refunded), their
// bookings must come from a pack; members who never bought one are unaffected.
export function memberOwnsPack(packs: PackLike[]): boolean {
  return packs.length > 0;
}

// The pack a booking draws from: the oldest active pack that still has
// credits, or null when nothing is drawable.
export function pickPackToDraw<T extends PackLike>(packs: T[]): T | null {
  const drawable = packs
    .filter((pack) => pack.status === "active" && pack.creditsRemaining > 0)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return drawable[0] ?? null;
}

export function hasDrawableCredit(packs: PackLike[]): boolean {
  return pickPackToDraw(packs) !== null;
}
