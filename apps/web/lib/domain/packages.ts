import type { Package } from "@/lib/db/types";

const CENTS_PER_CREDIT = 1000;

export function packPriceCents(credits: number): number {
  return credits * CENTS_PER_CREDIT;
}

export function pickPackToDraw(packages: Package[]): Package | null {
  const active = packages.filter((pkg) => pkg.status === "active" && pkg.creditsRemaining > 0);
  if (active.length === 0) return null;
  return active.reduce((oldest, pkg) => (pkg.purchasedAt < oldest.purchasedAt ? pkg : oldest));
}

export function hasEverPurchased(packages: Package[]): boolean {
  return packages.length > 0;
}

export interface CreatePackageView {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export interface ListPackageView {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export function createPackageView(pkg: Package): CreatePackageView {
  return {
    id: pkg.id,
    memberId: pkg.memberId,
    creditsTotal: pkg.creditsTotal,
    creditsRemaining: pkg.creditsRemaining,
    priceCents: pkg.priceCents,
    status: pkg.status,
    purchasedAt: pkg.purchasedAt,
  };
}

export function listPackageView(pkg: Package): ListPackageView {
  return {
    id: pkg.id,
    creditsTotal: pkg.creditsTotal,
    creditsRemaining: pkg.creditsRemaining,
    priceCents: pkg.priceCents,
    status: pkg.status,
    purchasedAt: pkg.purchasedAt,
  };
}
