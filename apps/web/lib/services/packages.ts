import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage } from "@/lib/db/types";
import { selectPackageToSpend } from "@/lib/domain/credits";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const PRICE_PER_CREDIT_CENTS = 1000;

export async function purchasePackage(
  repos: Repositories,
  input: CreatePackageInput,
): Promise<ClassPackage> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");

  return repos.classPackages.insert({
    id: newId(),
    studioId: member.studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: input.credits * PRICE_PER_CREDIT_CENTS,
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
}

export async function listMemberPackages(
  repos: Repositories,
  memberId: string,
): Promise<ClassPackage[]> {
  const packages = await repos.classPackages.listByMember(memberId);
  return [...packages].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPackage> {
  const classPackage = await repos.classPackages.getById(id);
  if (!classPackage) throw new HttpError(404, "not_found", "Package not found");
  return repos.classPackages.update(id, { creditsRemaining: 0, status: "refunded" });
}

// Draw one credit from the member's oldest eligible pack for a booking. A
// member who has never bought a pack is unaffected (returns null); one who has
// packs but none with credits left is blocked with a 402.
export async function spendCreditForBooking(
  repos: Repositories,
  memberId: string,
): Promise<ClassPackage | null> {
  const packages = await repos.classPackages.listByMember(memberId);
  if (packages.length === 0) return null;

  const toSpend = selectPackageToSpend(packages);
  if (!toSpend) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member has no class credits left — buy another pack",
    );
  }

  return repos.classPackages.update(toSpend.id, { creditsRemaining: toSpend.creditsRemaining - 1 });
}
