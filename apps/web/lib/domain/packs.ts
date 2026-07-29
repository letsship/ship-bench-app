import type { ClassPack } from "@/lib/db/types";

export const CREDIT_PRICE_CENTS = 1000;

export function packPriceCents(credits: number): number {
  return credits * CREDIT_PRICE_CENTS;
}

export function pickDrawablePack(packs: ClassPack[]): ClassPack | null {
  const active = packs.filter((p) => p.status === "active" && p.creditsRemaining > 0);
  if (active.length === 0) return null;
  return active.reduce((earliest, pack) =>
    pack.purchasedAt < earliest.purchasedAt ? pack : earliest,
  );
}