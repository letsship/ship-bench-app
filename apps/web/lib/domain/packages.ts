// Class-pack rules. Pure over minimal shapes so the services, booking flow,
// and tests can exercise every branch without a database. A pack is a prepaid
// bundle of class credits: each confirmed booking spends one credit from the
// member's oldest drawable pack until it runs out.

export type ClassPackStatus = "active" | "refunded";

// Minimal structural view of a ClassPack row. Mirrors the entity in
// lib/db/types.ts without importing it (domain stays db-free).
export interface PackLike {
  id: string;
  creditsRemaining: number;
  status: string;
  purchasedAt: string;
}

export const PACK_SIZES = [5, 10] as const;
export type PackSize = (typeof PACK_SIZES)[number];

export const PRICE_PER_CREDIT_CENTS = 1000;

// Total pack price in cents: credits × per-credit rate. A 5-credit pack is
// 5000, a 10-credit pack is 10000 (priceCents is the TOTAL, not the per-credit
// rate).
export function priceForCredits(credits: number): number {
  return credits * PRICE_PER_CREDIT_CENTS;
}

export function isValidPackSize(credits: number): credits is PackSize {
  return (PACK_SIZES as readonly number[]).includes(credits);
}

// A pack is drawable while it is active and still has credits left. Refunded
// and exhausted packs are never drawn from again.
export function isDrawable(pack: PackLike): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

// Oldest active pack with credits remaining, so credits drain from the pack a
// member bought earliest first. Null when nothing is drawable.
export function pickDrawablePack<T extends PackLike>(packs: readonly T[]): T | null {
  const drawable = packs.filter(isDrawable);
  if (drawable.length === 0) return null;
  return drawable.reduce((oldest, pack) =>
    pack.purchasedAt < oldest.purchasedAt ? pack : oldest,
  );
}

// Whether a member has ever bought a pack. Once true, their bookings must be
// paid with credits (an exhausted member is blocked until they buy another).
export function memberOwnsAnyPack(packs: readonly PackLike[]): boolean {
  return packs.length > 0;
}
