// Class-pack credit draw rule. A member who never bought a pack books exactly
// as before ("not applicable"); a member who owns one or more packs must draw
// a credit from the oldest pack that still has one, and is blocked once every
// pack they own is exhausted or refunded.

export interface PackageForDraw {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

export type CreditDrawDecision =
  | { applicable: false }
  | { applicable: true; ok: true; packageId: string }
  | { applicable: true; ok: false };

export function decideCreditDraw(packages: readonly PackageForDraw[]): CreditDrawDecision {
  if (packages.length === 0) return { applicable: false };

  const usable = packages.filter((pack) => pack.status === "active" && pack.creditsRemaining > 0);
  if (usable.length === 0) return { applicable: true, ok: false };

  const oldest = [...usable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
  return { applicable: true, ok: true, packageId: oldest.id };
}
