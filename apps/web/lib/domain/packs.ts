export const PACK_CREDIT_OPTIONS = [5, 10] as const;
export const CREDIT_PRICE_CENTS = 1000;

export type PackCredits = (typeof PACK_CREDIT_OPTIONS)[number];
export type PackStatus = "active" | "refunded";

export interface DrawablePack {
  status: PackStatus;
  creditsRemaining: number;
}

export interface PackWithPurchaseDate extends DrawablePack {
  purchasedAt: string;
}

export function packPriceCents(credits: PackCredits): number {
  return credits * CREDIT_PRICE_CENTS;
}

export function isDrawable(pack: DrawablePack): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

export function pickPackToDraw<T extends PackWithPurchaseDate>(packs: readonly T[]): T | null {
  return (
    [...packs].filter(isDrawable).sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0] ??
    null
  );
}

export function ownsAnyPack(packs: readonly unknown[]): boolean {
  return packs.length > 0;
}
