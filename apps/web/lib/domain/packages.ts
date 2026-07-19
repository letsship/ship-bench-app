import type { ClassPack } from "@/lib/db/types";

export const PACK_CREDIT_SIZES = [5, 10] as const;
export const PRICE_CENTS_PER_CREDIT = 1000;

export function priceForCredits(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

export function pickPackToDraw(packs: ClassPack[]): ClassPack | null {
  const activeDrawable = packs.filter((p) => p.status === "active" && p.creditsRemaining > 0);
  if (activeDrawable.length === 0) return null;
  return activeDrawable.reduce((oldest, current) =>
    current.purchasedAt < oldest.purchasedAt ? current : oldest,
  );
}

export function memberHasPack(packs: ClassPack[]): boolean {
  return packs.length > 0;
}
