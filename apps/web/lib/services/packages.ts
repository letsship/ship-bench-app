import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import { packPriceCents } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

export interface PackageListItem {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

export interface PackageCreateResponse extends PackageListItem {
  memberId: string;
}

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageCreateResponse> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member");
  }

  const now = nowIso();
  const packageId = newId();
  const pkg = await repos.packages.insert({
    id: packageId,
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: now,
    createdAt: now,
  });

  return {
    id: pkg.id,
    memberId: pkg.memberId,
    creditsTotal: pkg.creditsTotal,
    creditsRemaining: pkg.creditsRemaining,
    priceCents: pkg.priceCents,
    status: pkg.status,
    purchasedAt: pkg.purchasedAt,
  };
}

export async function listPackages(
  repos: Repositories,
  memberId: string,
): Promise<PackageListItem[]> {
  const packages = await repos.packages.listByMember(memberId);
  return packages.map((pkg) => ({
    id: pkg.id,
    creditsTotal: pkg.creditsTotal,
    creditsRemaining: pkg.creditsRemaining,
    priceCents: pkg.priceCents,
    status: pkg.status,
    purchasedAt: pkg.purchasedAt,
  }));
}

export async function refundPackage(repos: Repositories, id: string): Promise<PackageListItem> {
  const pkg = await repos.packages.getById(id);
  if (!pkg) {
    throw new HttpError(404, "not_found", "Package not found");
  }

  const refunded = await repos.packages.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });

  return {
    id: refunded.id,
    creditsTotal: refunded.creditsTotal,
    creditsRemaining: refunded.creditsRemaining,
    priceCents: refunded.priceCents,
    status: refunded.status,
    purchasedAt: refunded.purchasedAt,
  };
}
