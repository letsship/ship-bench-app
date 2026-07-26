import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { packPriceCents } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<ClassPack> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this package");
  }

  const now = new Date().toISOString();
  return repos.packages.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt: now,
    createdAt: now,
  });
}

export async function listPackages(repos: Repositories, memberId: string): Promise<ClassPack[]> {
  const packages = await repos.packages.listByMember(memberId);
  return [...packages].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPack> {
  const pack = await repos.packages.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Package not found");
  return repos.packages.update(id, { creditsRemaining: 0, status: "refunded" });
}
