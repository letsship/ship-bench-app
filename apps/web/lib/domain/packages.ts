import type { Package } from "@/lib/db/types";

export const PRICE_PER_CREDIT_CENTS = 1000;
export const ALLOWED_SIZES = [5, 10];

export function packPriceCents(credits: number): number {
  return credits * PRICE_PER_CREDIT_CENTS;
}

export function pickPackToDraw(packs: Package[]): Package | null {
  const activePacks = packs.filter((p) => p.status === "active" && p.creditsRemaining > 0);
  if (activePacks.length === 0) return null;
  return activePacks.sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
}

export function hasEverOwnedPack(packs: Package[]): boolean {
  return packs.length > 0;
}
