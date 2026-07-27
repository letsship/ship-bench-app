import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { creditsToPriceCents, pickDrawablePack, voidPackForRefund } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackInput } from "@/lib/validation";

export interface PackResponse {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toResponse(pack: ClassPack): PackResponse {
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

export async function createPack(
  repos: Repositories,
  studioId: string,
  input: CreatePackInput,
): Promise<PackResponse> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this pack");
  }

  const pack = await repos.classPacks.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: creditsToPriceCents(input.credits),
    status: "active",
    purchasedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  return toResponse(pack);
}

export async function listPacks(repos: Repositories, memberId: string): Promise<PackResponse[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return [...packs].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)).map(toResponse);
}

export async function refundPack(repos: Repositories, id: string): Promise<PackResponse> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  const updated = await repos.classPacks.update(id, voidPackForRefund());
  return toResponse(updated);
}

// Draws one credit from the member's oldest drawable pack for a confirmed
// booking. Returns null when the member owns no packs at all (books unchanged,
// exactly as today). Throws 402 pack_exhausted when the member owns packs but
// none has credits left to draw.
export async function drawCreditForBooking(
  repos: Repositories,
  memberId: string,
): Promise<string | null> {
  const packs = await repos.classPacks.listByMember(memberId);
  if (packs.length === 0) return null;

  const drawable = pickDrawablePack(packs);
  if (!drawable) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member has no class pack credits left — buy another pack",
    );
  }

  await repos.classPacks.update(drawable.id, {
    creditsRemaining: drawable.creditsRemaining - 1,
  });
  return drawable.id;
}
