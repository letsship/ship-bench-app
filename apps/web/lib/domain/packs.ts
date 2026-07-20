import type { ClassPack } from "@/lib/db/types";

export const PACK_CREDIT_OPTIONS = [5, 10] as const;

export function packPriceCents(credits: number): number {
  return credits * 1000;
}

export function memberHasPurchasedPack(packs: ClassPack[]): boolean {
  return packs.length > 0;
}

export function pickPackToDraw(packs: ClassPack[]): ClassPack | null {
  const sorted = [...packs].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  for (const pack of sorted) {
    if (pack.status === "active" && pack.creditsRemaining > 0) {
      return pack;
    }
  }
  return null;
}
