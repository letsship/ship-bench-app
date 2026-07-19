import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { BuyPackInput } from "@/lib/validation";
import { HttpError } from "@/lib/http";
import { packPriceCents, packView, refundedPackPatch } from "@/lib/domain/packs";

export async function buyPack(
  repos: Repositories,
  studioId: string,
  input: BuyPackInput,
): Promise<ReturnType<typeof packView>> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this pack");
  }

  const packId = newId();
  const priceCents = packPriceCents(input.credits);
  const purchasedAt = new Date().toISOString();

  const pack = await repos.classPacks.insert({
    id: packId,
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents,
    status: "active",
    purchasedAt,
  });

  return packView(pack);
}

export async function listMemberPacks(
  repos: Repositories,
  memberId: string,
): Promise<ReturnType<typeof packView>[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs.map(packView);
}

export async function refundPack(
  repos: Repositories,
  id: string,
): Promise<ReturnType<typeof packView>> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Pack not found");

  const updated = await repos.classPacks.update(id, refundedPackPatch());
  return packView(updated);
}
