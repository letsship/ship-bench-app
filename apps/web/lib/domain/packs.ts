// Class packs: prepaid bundles of class credits. A member buys a pack of 5 or
// 10 credits; each booking spends one credit (oldest pack first) until the
// pack runs out. Pure rules only — no framework, database, or request imports.

export const PRICE_CENTS_PER_CREDIT = 1000;
export const ALLOWED_PACK_CREDITS = [5, 10] as const;

export type PackStatus = "active" | "exhausted" | "refunded";

// The subset of a ClassPack row the draw decision needs.
export interface PackLike {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

export type PackDrawDecision =
  { kind: "no_pack" } | { kind: "draw"; packId: string } | { kind: "exhausted" };

// Total pack price in cents (the pack TOTAL, not a per-credit rate).
export function priceForCredits(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

const isDrawable = (pack: PackLike): boolean =>
  pack.status === "active" && pack.creditsRemaining > 0;

// Decide how a member's next booking is paid for: members with no packs book
// as one-offs; members with packs draw from the oldest pack with credits left;
// members whose packs are all spent or refunded are exhausted.
export function decidePackDraw(packs: readonly PackLike[]): PackDrawDecision {
  if (packs.length === 0) return { kind: "no_pack" };
  const oldest = packs
    .filter(isDrawable)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
  return oldest ? { kind: "draw", packId: oldest.id } : { kind: "exhausted" };
}
