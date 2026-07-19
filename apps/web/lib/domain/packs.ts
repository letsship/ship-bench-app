import type { ClassPack } from "@/lib/db/types";

export const PRICE_PER_CREDIT_CENTS = 1000;

export function packPriceCents(credits: number): number {
  return credits * PRICE_PER_CREDIT_CENTS;
}

export function isDrawable(pack: ClassPack): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

export function pickPackToSpend(packs: ClassPack[]): ClassPack | null {
  const drawable = packs
    .filter(isDrawable)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return drawable[0] ?? null;
}

export function spendCredit(pack: ClassPack): Partial<ClassPack> {
  const creditsRemaining = pack.creditsRemaining - 1;
  return {
    creditsRemaining,
    status: creditsRemaining === 0 ? "exhausted" : pack.status,
  };
}

export function refundedPackPatch(): Partial<ClassPack> {
  return { creditsRemaining: 0, status: "refunded" };
}

export interface PackViewResponse {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export function packView(pack: ClassPack): PackViewResponse {
  return {
    id: pack.id,
    memberId: pack.memberId,
    creditsTotal: pack.creditsTotal,
    creditsRemaining: pack.creditsRemaining,
    priceCents: pack.priceCents,
    status: pack.status,
    purchasedAt: pack.purchasedAt,
  };
}
