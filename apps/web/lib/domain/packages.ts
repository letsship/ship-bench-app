import type { ClassPack } from "@/lib/db/types";

export function packPriceCents(credits: number): number {
  return credits * 1000;
}

export function pickPackToDeduct(activePacks: ClassPack[]): ClassPack | null {
  return activePacks.find((pack) => pack.creditsRemaining > 0) ?? null;
}

export function totalCreditsRemaining(packs: ClassPack[]): number {
  return packs.reduce((sum, pack) => sum + pack.creditsRemaining, 0);
}
