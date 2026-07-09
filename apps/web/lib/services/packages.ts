import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { PACK_PRICE_PER_CREDIT_CENTS, pickSpendablePack } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export async function createPackage(
  repos: Repositories,
  input: CreatePackageInput,
): Promise<ClassPack> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(400, "bad_request", "Unknown member for this package");

  return repos.classPacks.insert({
    id: newId(),
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: input.credits * PACK_PRICE_PER_CREDIT_CENTS,
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
}

export async function listPackagesForMember(
  repos: Repositories,
  memberId: string,
): Promise<ClassPack[]> {
  return repos.classPacks.listByMember(memberId);
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPack> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Package not found");
  return repos.classPacks.update(id, { creditsRemaining: 0, status: "refunded" });
}

// Spends one credit from the member's oldest spendable pack. A member with no
// packs at all is unaffected (no-op); a member whose packs are all exhausted
// or refunded is rejected — they must buy another.
export async function drawPackCredit(repos: Repositories, memberId: string): Promise<void> {
  const packs = await repos.classPacks.listByMember(memberId);
  if (packs.length === 0) return;

  const spendable = pickSpendablePack(packs);
  if (!spendable) {
    throw new HttpError(402, "pack_exhausted", "This member has no class pack credits left");
  }

  await repos.classPacks.update(spendable.id, {
    creditsRemaining: spendable.creditsRemaining - 1,
  });
}
