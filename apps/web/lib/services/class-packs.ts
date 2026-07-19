import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import { HttpError } from "@/lib/http";
import { packPriceCents, refundPatch } from "@/lib/domain/class-packs";
import { getStudioContext } from "./studio";

const nowIso = (): string => new Date().toISOString();

export interface BuyPackResult {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export async function buyClassPack(
  repos: Repositories,
  input: { memberId: string; credits: number },
): Promise<BuyPackResult> {
  const { studio } = await getStudioContext(repos);
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");

  const packId = newId();
  const priceCents = packPriceCents(input.credits);
  const now = nowIso();
  const pack = await repos.classPacks.insert({
    id: packId,
    studioId: studio.id,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents,
    status: "active",
    purchasedAt: now,
  });

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

export interface ListPackResult {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export async function listClassPacks(
  repos: Repositories,
  memberId: string,
): Promise<ListPackResult[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs.map((pack) => ({
    id: pack.id,
    creditsTotal: pack.creditsTotal,
    creditsRemaining: pack.creditsRemaining,
    priceCents: pack.priceCents,
    status: pack.status,
    purchasedAt: pack.purchasedAt,
  }));
}

export interface RefundPackResult {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export async function refundClassPack(repos: Repositories, id: string): Promise<RefundPackResult> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Pack not found");

  const refunded = await repos.classPacks.update(id, refundPatch());

  return {
    id: refunded.id,
    creditsTotal: refunded.creditsTotal,
    creditsRemaining: refunded.creditsRemaining,
    priceCents: refunded.priceCents,
    status: refunded.status,
    purchasedAt: refunded.purchasedAt,
  };
}
