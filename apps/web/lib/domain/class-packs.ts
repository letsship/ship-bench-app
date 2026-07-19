import type { ClassPack } from "@/lib/db/types";

export function packPriceCents(credits: number): number {
  return credits * 1000;
}

export function isDrawable(pack: ClassPack): boolean {
  return pack.status === "active" && pack.creditsRemaining > 0;
}

export function pickPackToDraw(packs: ClassPack[]): ClassPack | null {
  return packs.find(isDrawable) ?? null;
}

export function refundPatch(): Partial<ClassPack> {
  return { creditsRemaining: 0, status: "refunded" };
}
