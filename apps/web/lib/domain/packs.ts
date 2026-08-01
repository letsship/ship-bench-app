interface ClassPack {
  id: string;
  status: string;
  creditsRemaining: number;
  purchasedAt: string;
}

export const CREDIT_PRICE_CENTS = 1000;

export function priceForCredits(credits: number): number {
  return credits * CREDIT_PRICE_CENTS;
}

export function isDrawable(pack: ClassPack): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

export function pickDrawablePack(packs: ClassPack[]): ClassPack | null {
  return (
    packs
      .filter(isDrawable)
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0] ?? null
  );
}

export function ownsAnyPack(packs: ClassPack[]): boolean {
  return packs.length > 0;
}
