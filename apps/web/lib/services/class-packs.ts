import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { hasAnyPack, pickPackToDraw, priceForCredits } from "@/lib/domain/class-packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export interface ClassPackView {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toView(pack: ClassPack): ClassPackView {
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

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<ClassPackView> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");

  const pack = await repos.classPacks.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: priceForCredits(input.credits),
    status: "active",
    purchasedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  return toView(pack);
}

export async function listMemberPackages(
  repos: Repositories,
  memberId: string,
): Promise<ClassPackView[]> {
  const packs = await repos.classPacks.listByMember(memberId);
  return packs.map(toView);
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPackView> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  const refunded = await repos.classPacks.update(id, { creditsRemaining: 0, status: "refunded" });
  return toView(refunded);
}

export interface SpendResult {
  drew: boolean;
}

// Draw one credit from the member's oldest active pack for a confirmed
// booking. A member who never bought a pack books unchanged (`drew: false`).
// A pack-owner with nothing left to draw is blocked with 402 pack_exhausted.
export async function spendPackCredit(repos: Repositories, memberId: string): Promise<SpendResult> {
  const packs = await repos.classPacks.listByMember(memberId);
  if (!hasAnyPack(packs)) return { drew: false };

  const pack = pickPackToDraw(packs);
  if (!pack) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member has no class credits left. Buy another pack to continue booking.",
    );
  }

  await repos.classPacks.update(pack.id, { creditsRemaining: pack.creditsRemaining - 1 });
  return { drew: true };
}
