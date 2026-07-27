import type { ClassPack } from "@/lib/db/types";

const PRICE_CENTS_PER_CREDIT = 1000;

export function packPriceCents(credits: number): number {
  return credits * PRICE_CENTS_PER_CREDIT;
}

export function pickPackToDraw(packs: ClassPack[]): ClassPack | null {
  return (
    packs
      .filter((p) => p.status === "active" && p.creditsRemaining > 0)
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0] ?? null
  );
}

export function deriveStatusAfterSpend(creditsRemaining: number): string {
  return creditsRemaining === 0 ? "exhausted" : "active";
}

export interface PackResponse {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export function toPackResponse(pack: ClassPack): PackResponse {
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
