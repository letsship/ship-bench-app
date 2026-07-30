import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { pickDrawablePack, priceForCredits } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

// Prepaid class packs: purchase, listing, refund, and the credit draw that
// bookings use. Selection and pricing live in lib/domain/packs.ts; this module
// only composes them with the repository seam.

const nowIso = (): string => new Date().toISOString();

export async function createPackage(
  repos: Repositories,
  input: CreatePackageInput,
): Promise<ClassPack> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  return repos.classPacks.insert({
    id: newId(),
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: priceForCredits(input.credits),
    status: "active",
    purchasedAt: nowIso(),
  });
}

// Newest first — the repository seam already guarantees that order.
export async function listPackages(repos: Repositories, memberId: string): Promise<ClassPack[]> {
  return repos.classPacks.listByMember(memberId);
}

// Refunding voids whatever is left so those credits can never be spent.
export async function refundPackage(repos: Repositories, id: string): Promise<ClassPack> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  return repos.classPacks.update(id, { status: "refunded", creditsRemaining: 0 });
}

export interface PackDraw {
  // The member owns at least one pack, so their bookings must be paid from one.
  hasPacks: boolean;
  // The pack a booking would spend from, or null when nothing is drawable.
  drawnPackId: string | null;
}

// Choose (but do not yet spend) the credit a booking would use. Selection and
// spending are separate so a booking rejected after this point — or one that
// never happens — leaves the member's credits untouched.
export async function drawCreditForMember(
  repos: Repositories,
  memberId: string,
): Promise<PackDraw> {
  const packs = await repos.classPacks.listByMember(memberId);
  return { hasPacks: packs.length > 0, drawnPackId: pickDrawablePack(packs)?.id ?? null };
}

// Commit the draw: burn one credit from the chosen pack.
export async function spendPackCredit(repos: Repositories, packId: string): Promise<ClassPack> {
  const pack = await repos.classPacks.getById(packId);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  return repos.classPacks.update(packId, {
    creditsRemaining: Math.max(0, pack.creditsRemaining - 1),
  });
}
