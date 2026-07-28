import type { Pack } from "@/lib/db/types";

// Pure domain rules for class packs. No framework, database, or request
// imports — completely unit-testable in isolation.

export const PACK_PRICE_PER_CREDIT_CENTS = 1000;

/** Total price in cents for a pack with the given number of credits. */
export function packPriceCents(credits: number): number {
  return credits * PACK_PRICE_PER_CREDIT_CENTS;
}

/** Whether a pack is drawable: active and has credits remaining. */
export function isDrawable(pack: Pack): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

/**
 * From a list of packs, pick the oldest drawable one (by purchasedAt asc).
 * Returns null if none are drawable.
 */
export function pickDrawablePack(packs: readonly Pack[]): Pack | null {
  const drawable = [...packs].filter(isDrawable);
  if (drawable.length === 0) return null;
  return drawable.sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
}

/** Whether the member owns at least one pack. */
export function memberOwnsAnyPack(packs: readonly Pack[]): boolean {
  return packs.length > 0;
}