import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const PRICE_CENTS_PER_CREDIT = 1000;

export interface ClassPackageListItem {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toListItem(classPackage: ClassPackage): ClassPackageListItem {
  return {
    id: classPackage.id,
    creditsTotal: classPackage.creditsTotal,
    creditsRemaining: classPackage.creditsRemaining,
    priceCents: classPackage.priceCents,
    status: classPackage.status,
    purchasedAt: classPackage.purchasedAt,
  };
}

export async function purchasePackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<ClassPackage> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this package");
  }

  return repos.classPackages.insert({
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: PRICE_CENTS_PER_CREDIT,
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
}

export async function listPackagesForMember(
  repos: Repositories,
  memberId: string,
): Promise<ClassPackageListItem[]> {
  const packages = await repos.classPackages.listByMember(memberId);
  return packages.map(toListItem);
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPackage> {
  const classPackage = await repos.classPackages.getById(id);
  if (!classPackage) throw new HttpError(404, "not_found", "Class package not found");
  return repos.classPackages.update(id, { creditsRemaining: 0, status: "refunded" });
}
