import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage } from "@/lib/db/types";
import { CREDIT_PRICE_CENTS } from "@/lib/domain/class-packages";
import { HttpError } from "@/lib/http";
import type { CreateClassPackageInput } from "@/lib/validation";

export async function listClassPackages(
  repos: Repositories,
  memberId: string,
): Promise<ClassPackage[]> {
  return repos.classPackages.listByMember(memberId);
}

export async function purchaseClassPackage(
  repos: Repositories,
  input: CreateClassPackageInput,
): Promise<ClassPackage> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  return repos.classPackages.insert({
    id: newId(),
    studioId: member.studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: CREDIT_PRICE_CENTS,
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
}

export async function refundClassPackage(repos: Repositories, id: string): Promise<ClassPackage> {
  const pack = await repos.classPackages.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class package not found");
  return repos.classPackages.update(id, { creditsRemaining: 0, status: "refunded" });
}
