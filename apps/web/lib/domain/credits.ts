import type { ClassPackage } from "../db/types";

// Which pack pays for a booking: the oldest active pack that still has a
// credit to spend, or null when the member has none left.
export function selectPackageToSpend(packages: readonly ClassPackage[]): ClassPackage | null {
  const eligible = packages.filter((pkg) => pkg.status === "active" && pkg.creditsRemaining > 0);
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0];
}
