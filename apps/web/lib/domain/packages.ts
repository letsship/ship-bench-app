import type { ClassPack } from "@/lib/db/types";

// Pure pack pricing and selection rules, no database or framework imports.

const PRICE_CENTS_PER_CREDIT = 1000;

export function packPriceCents(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

export type PackStatus = "active" | "refunded";

export function memberHasAnyPack(packs: ClassPack[]): boolean {
  return packs.length > 0;
}

export function selectPackToSpend(packs: ClassPack[]): ClassPack | null {
  // Oldest active pack with credits remaining.
  const active = packs.filter((p) => p.status === "active" && p.creditsRemaining > 0);
  if (active.length === 0) return null;
  return active.reduce((oldest, current) =>
    current.purchasedAt < oldest.purchasedAt ? current : oldest,
  );
}
