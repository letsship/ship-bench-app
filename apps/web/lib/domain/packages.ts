// Class pack pricing + credit-draw rules. Pure decisions over minimal shapes so
// services and tests can exercise every branch without touching a repository.

export const CENTS_PER_CREDIT = 1000;

export function computePackPrice(credits: number): number {
  return credits * CENTS_PER_CREDIT;
}

// Which pack a booking should draw a credit from: the oldest active pack that
// still has credits left, or null when the member has nothing left to spend.
export function pickPackToSpend(
  packages: readonly {
    id: string;
    status: string;
    creditsRemaining: number;
    purchasedAt: string;
  }[],
): string | null {
  const spendable = packages.filter((pkg) => pkg.status === "active" && pkg.creditsRemaining > 0);
  if (spendable.length === 0) return null;
  return [...spendable].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0].id;
}
