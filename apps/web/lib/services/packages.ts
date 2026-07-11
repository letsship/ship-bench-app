import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage } from "@/lib/db/types";
import { computePackPrice } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export async function listPackages(repos: Repositories, memberId: string): Promise<ClassPackage[]> {
  return repos.classPackages.listByMember(memberId);
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
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: computePackPrice(input.credits),
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPackage> {
  const pkg = await repos.classPackages.getById(id);
  if (!pkg) throw new HttpError(404, "not_found", "Package not found");
  return repos.classPackages.update(id, { creditsRemaining: 0, status: "refunded" });
}
