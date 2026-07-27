import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import type { CreatePackInput } from "@/lib/validation";

export interface PackBuyView {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export interface PackListItem {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

const PRICE_CENTS_PER_CREDIT = 1000;

function toBuyView(pack: ClassPack): PackBuyView {
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

function toListItem(pack: ClassPack): PackListItem {
  return {
    id: pack.id,
    creditsTotal: pack.creditsTotal,
    creditsRemaining: pack.creditsRemaining,
    priceCents: pack.priceCents,
    status: pack.status,
    purchasedAt: pack.purchasedAt,
  };
}

export async function buyPack(
  repos: Repositories,
  studioId: string,
  input: CreatePackInput,
): Promise<PackBuyView> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(404, "not_found", "Member not found");
  }

  const pack = await repos.classPacks.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: input.credits * PRICE_CENTS_PER_CREDIT,
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
  return toBuyView(pack);
}

export async function listPacks(repos: Repositories, memberId: string): Promise<PackListItem[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)).map(toListItem);
}

export async function refundPack(repos: Repositories, id: string): Promise<PackBuyView> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  const updated = await repos.classPacks.update(id, { creditsRemaining: 0, status: "refunded" });
  return toBuyView(updated);
}
