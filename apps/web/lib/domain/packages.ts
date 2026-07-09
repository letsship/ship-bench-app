import type { ClassPackage } from "@/lib/db/types";

// Which pack a booking should draw a credit from: the oldest active pack that
// still has credits left. Exhausted and refunded packs are skipped.
export function pickPackageToSpend(packages: readonly ClassPackage[]): ClassPackage | null {
  const spendable = packages.filter((pkg) => pkg.status === "active" && pkg.creditsRemaining > 0);
  if (spendable.length === 0) return null;
  return [...spendable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
}
