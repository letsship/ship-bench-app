// Pure pack domain rules — pricing, pack sizes, and draw-order selection.
// No framework or database imports.

export const PACK_CREDIT_PRICE_CENTS = 1000;
export const ALLOWED_PACK_SIZES = [5, 10] as const;

export type PackStatus = "active" | "refunded";

export function priceForCredits(credits: number): number {
  return credits * PACK_CREDIT_PRICE_CENTS;
}

export interface DrawablePack {
  id: string;
  creditsRemaining: number;
  purchasedAt: string;
  status: PackStatus;
}

export function pickDrawablePack(packs: DrawablePack[]): DrawablePack | null {
  const drawable = packs
    .filter((pack) => pack.status === "active" && pack.creditsRemaining > 0)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return drawable.length > 0 ? drawable[0] : null;
}
