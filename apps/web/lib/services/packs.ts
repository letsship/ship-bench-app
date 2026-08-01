import { newId } from "@/lib/db/ids";
import type { ClassPack } from "@/lib/db/types";
import { ownsAnyPack, pickDrawablePack, priceForCredits } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";
import type { Repositories } from "../db/repos/types";

export interface PackView {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export type PackListView = Omit<PackView, "memberId">;

function viewOf(pack: ClassPack): PackView {
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

export async function listPacks(repos: Repositories, memberId: string): Promise<PackListView[]> {
  return (await repos.classPacks.listByMember(memberId)).map(({ memberId: _memberId, ...pack }) => pack);
}

export async function createPack(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackView> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this package");
  }

  const purchasedAt = new Date().toISOString();
  const pack = await repos.classPacks.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: priceForCredits(input.credits),
    status: "active",
    purchasedAt,
    createdAt: purchasedAt,
  });
  return viewOf(pack);
}

export async function refundPack(repos: Repositories, id: string): Promise<PackView> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  return viewOf(await repos.classPacks.update(id, { creditsRemaining: 0, status: "refunded" }));
}

export async function drawCreditForBooking(repos: Repositories, memberId: string): Promise<void> {
  const packs = await repos.classPacks.listByMember(memberId);
  if (!ownsAnyPack(packs)) return;

  const pack = pickDrawablePack(packs);
  if (!pack) {
    throw new HttpError(402, "pack_exhausted", "This member's class pack has no credits left");
  }
  await repos.classPacks.update(pack.id, { creditsRemaining: pack.creditsRemaining - 1 });
}
