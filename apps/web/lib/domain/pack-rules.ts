// Class-pack draw policy. Pure decision over a member's packs: which pack (if
// any) a new booking should spend a credit from.

export interface PackLike {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

export type PackDrawDecision =
  { kind: "none" } | { kind: "draw"; packId: string } | { kind: "exhausted" };

function isDrawable(pack: PackLike): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

// Decide how a booking should draw against a member's packs: no packs ever
// owned books unchanged; the oldest drawable pack (by purchasedAt) is spent;
// packs owned but all exhausted/refunded blocks the booking.
export function resolvePackDraw(packs: readonly PackLike[]): PackDrawDecision {
  if (packs.length === 0) return { kind: "none" };
  const drawable = packs.filter(isDrawable);
  if (drawable.length === 0) return { kind: "exhausted" };
  const oldest = [...drawable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
  return { kind: "draw", packId: oldest.id };
}
