export const PACK_CREDIT_OPTIONS = [5, 10] as const;
export const PRICE_PER_CREDIT_CENTS = 1000;

export interface PackCreditState {
  creditsRemaining: number;
  purchasedAt: string;
  status: string;
}

export function packPriceCents(credits: number): number {
  return credits * PRICE_PER_CREDIT_CENTS;
}

export function pickDrawablePack<T extends PackCreditState>(packs: readonly T[]): T | null {
  return (
    [...packs]
      .filter((pack) => pack.status === "active" && pack.creditsRemaining > 0)
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0] ?? null
  );
}

export function applyDraw<T extends PackCreditState>(pack: T): T {
  const creditsRemaining = pack.creditsRemaining - 1;
  return { ...pack, creditsRemaining, status: creditsRemaining === 0 ? "exhausted" : pack.status };
}

export function isPackGated(packs: readonly unknown[]): boolean {
  return packs.length > 0;
}
