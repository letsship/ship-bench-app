import type { ClassPack } from "@/lib/db/types";

const PRICE_PER_CREDIT_CENTS = 1000;

export function packPriceCents(credits: number): number {
  return credits * PRICE_PER_CREDIT_CENTS;
}

export function memberOwnsAnyPack(packs: ClassPack[]): boolean {
  return packs.length > 0;
}

export function pickDrawablePack(packs: ClassPack[]): ClassPack | null {
  const sortedByAge = [...packs].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return sortedByAge.find((pack) => pack.status === "active" && pack.creditsRemaining > 0) ?? null;
}

export function drawFromPack(pack: ClassPack): Partial<ClassPack> {
  const creditsRemaining = pack.creditsRemaining - 1;
  return {
    creditsRemaining,
    status: creditsRemaining === 0 ? "exhausted" : "active",
  };
}
