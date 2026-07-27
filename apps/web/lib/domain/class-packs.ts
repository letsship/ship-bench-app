import type { ClassPack } from "../db/types";

// Class pack pricing + selection rules. Pure — no framework, database, or
// request concerns, matching booking-rules.ts.

export const PACK_CREDIT_PRICE_CENTS = 1000;
export const PACK_SIZES = [5, 10] as const;

export function priceForCredits(credits: number): number {
  return credits * PACK_CREDIT_PRICE_CENTS;
}

export function hasAnyPack(packs: readonly ClassPack[]): boolean {
  return packs.length > 0;
}

// The pack a booking should draw from: the oldest active pack with credits
// left, or null when none is drawable.
export function pickPackToDraw(packs: readonly ClassPack[]): ClassPack | null {
  const drawable = packs.filter((pack) => pack.status === "active" && pack.creditsRemaining > 0);
  if (drawable.length === 0) return null;
  return [...drawable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
}
