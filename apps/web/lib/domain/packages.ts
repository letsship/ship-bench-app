import type { ClassPack } from "@/lib/db/types";

// Pure class-pack business rules: pack sizes, pricing, which pack a booking
// draws from, and what a refund does. No framework, database, email, or
// request imports — services compose these with repositories.

export const PACK_CREDIT_OPTIONS = [5, 10] as const;
export const PRICE_PER_CREDIT_CENTS = 1000;

export type PackStatus = "active" | "refunded";

// The pack's TOTAL price in cents (5 -> 5000, 10 -> 10000).
export function packPriceCents(credits: number): number {
  return credits * PRICE_PER_CREDIT_CENTS;
}

// The pack a booking spends from: the oldest active pack that still has
// credits, or null when nothing can be drawn.
export function pickSpendablePack(packs: ClassPack[]): ClassPack | null {
  const spendable = packs
    .filter((pack) => pack.status === "active" && pack.creditsRemaining > 0)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return spendable[0] ?? null;
}

export function ownsAnyPack(packs: ClassPack[]): boolean {
  return packs.length > 0;
}

// A refund voids whatever credits remain so they can never be spent.
export function voidRemaining(_pack: ClassPack): Pick<ClassPack, "creditsRemaining" | "status"> {
  return { creditsRemaining: 0, status: "refunded" };
}
