import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { Package } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import { priceForCredits, pickDrawablePack, hasAnyPack } from "@/lib/domain/packages";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

export interface PackageDTO {
  id: string;
  memberId: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: string;
  purchasedAt: string;
}

function toDTO(pkg: Package): PackageDTO {
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

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<PackageDTO> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this package");
  }

  const now = nowIso();
  const priceCents = priceForCredits(input.credits);
  const pkg = await repos.packages.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents,
    status: "active",
    purchasedAt: now,
  });

  return toDTO(pkg);
}

export async function listPackages(repos: Repositories, memberId: string): Promise<PackageDTO[]> {
  const packages = await repos.packages.listByMember(memberId);
  return packages.map(toDTO);
}

export async function refundPackage(repos: Repositories, id: string): Promise<PackageDTO> {
  const pkg = await repos.packages.getById(id);
  if (!pkg) throw new HttpError(404, "not_found", "Package not found");

  const updated = await repos.packages.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });

  return toDTO(updated);
}

export async function drawCreditForBooking(repos: Repositories, memberId: string): Promise<void> {
  const packages = await repos.packages.listByMember(memberId);

  if (!hasAnyPack(packages)) {
    return;
  }

  const drawable = pickDrawablePack(packages);
  if (!drawable) {
    throw new HttpError(402, "pack_exhausted", "All class packs are exhausted");
  }

  await repos.packages.update(drawable.id, {
    creditsRemaining: drawable.creditsRemaining - 1,
  });
}
