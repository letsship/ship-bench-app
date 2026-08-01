import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member, Pack } from "@/lib/db/types";
import { applyDraw, isPackGated, packPriceCents, pickDrawablePack } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export type PackageResult = Pick<
  Pack,
  "id" | "memberId" | "creditsTotal" | "creditsRemaining" | "priceCents" | "status" | "purchasedAt"
>;

function packageResult(pack: Pack): PackageResult {
  const { id, memberId, creditsTotal, creditsRemaining, priceCents, status, purchasedAt } = pack;
  return { id, memberId, creditsTotal, creditsRemaining, priceCents, status, purchasedAt };
}

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageResult> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(404, "not_found", "Member not found");
  }

  const purchasedAt = new Date().toISOString();
  const pack = await repos.packs.insert({
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt,
    createdAt: purchasedAt,
  });
  return packageResult(pack);
}

export async function listPackages(repos: Repositories, memberId: string): Promise<PackageResult[]> {
  return (await repos.packs.listByMember(memberId)).map(packageResult);
}

export async function refundPackage(repos: Repositories, id: string): Promise<PackageResult> {
  const pack = await repos.packs.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Pack not found");
  return packageResult(await repos.packs.update(id, { creditsRemaining: 0, status: "refunded" }));
}

export async function drawCreditForBooking(repos: Repositories, member: Member): Promise<void> {
  const packs = await repos.packs.listByMember(member.id);
  if (!isPackGated(packs)) return;

  const pack = pickDrawablePack(packs);
  if (!pack) {
    throw new HttpError(402, "pack_exhausted", "No class pack credits remain; buy another pack");
  }
  await repos.packs.update(pack.id, applyDraw(pack));
}
