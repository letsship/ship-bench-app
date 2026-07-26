// Class pack (prepaid credit) rules. A member buys a pack of credits and each
// booking spends one credit, oldest active pack first, until it runs out.

export const PACK_CREDIT_OPTIONS = [5, 10] as const;
export type PackCredits = (typeof PACK_CREDIT_OPTIONS)[number];

export const PRICE_CENTS_PER_CREDIT = 1000;

export function packPriceCents(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

export type PackStatus = "active" | "refunded";

export interface PackDraw {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

export function isDrawable(pack: PackDraw): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

// Oldest drawable pack first, so a member's earliest purchase is spent down
// before a newer one.
export function pickPackToDraw(packs: readonly PackDraw[]): string | null {
  const drawable = packs
    .filter(isDrawable)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return drawable[0]?.id ?? null;
}

export function ownsAnyPack(packs: readonly unknown[]): boolean {
  return packs.length > 0;
}
