import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const PRICE_CENTS_PER_CREDIT = 1000;

export async function listPackages(repos: Repositories, memberId: string): Promise<ClassPackage[]> {
  return repos.classPackages.listByMember(memberId);
}

export async function createPackage(
  repos: Repositories,
  input: CreatePackageInput,
): Promise<ClassPackage> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");

  return repos.classPackages.insert({
    id: newId(),
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: input.credits * PRICE_CENTS_PER_CREDIT,
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPackage> {
  const classPackage = await repos.classPackages.getById(id);
  if (!classPackage) throw new HttpError(404, "not_found", "Class package not found");
  return repos.classPackages.update(id, { creditsRemaining: 0, status: "refunded" });
}
