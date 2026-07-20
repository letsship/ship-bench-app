import type { ClassPack } from "@/lib/db/types";

export const PACK_SIZES = [5, 10] as const;

export function packPriceCents(credits: number): number {
  return credits * 1000;
}

export function selectDrawablePack(packs: ClassPack[]): ClassPack | null {
  const sorted = [...packs].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return sorted.find((p) => p.status === "active" && p.creditsRemaining > 0) ?? null;
}

export function hasEverPurchased(packs: ClassPack[]): boolean {
  return packs.length > 0;
}
