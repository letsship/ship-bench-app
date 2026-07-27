import type { Package } from "@/lib/db/types";

export function priceForCredits(credits: number): number {
  return credits * 1000;
}

export function pickDrawablePack(packs: Package[]): Package | null {
  return (
    packs
      .filter((pkg) => pkg.status === "active" && pkg.creditsRemaining > 0)
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0] ?? null
  );
}

export function isActivePack(pkg: Package): boolean {
  return pkg.status === "active" && pkg.creditsRemaining > 0;
}

export function hasAnyPack(packs: Package[]): boolean {
  return packs.length > 0;
}
