import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import {
  createPackageView,
  listPackageView,
  packPriceCents,
  type CreatePackageView,
  type ListPackageView,
} from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<CreatePackageView> {
  const member = await repos.members.getById(input.memberId);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  if (member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Member does not belong to this studio");
  }

  const pkg = await repos.packages.insert({
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  return createPackageView(pkg);
}

export async function listPackages(
  repos: Repositories,
  memberId: string,
): Promise<ListPackageView[]> {
  const packages = await repos.packages.listByMember(memberId);
  return packages.map(listPackageView);
}

export async function refundPackage(repos: Repositories, id: string): Promise<ListPackageView> {
  const pkg = await repos.packages.getById(id);
  if (!pkg) throw new HttpError(404, "not_found", "Package not found");

  const refunded = await repos.packages.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });

  return listPackageView(refunded);
}
