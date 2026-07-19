import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { priceForCredits, pickPackToDraw, memberHasPack } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

export async function buyPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<ClassPack> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this studio");
  }

  const now = new Date().toISOString();
  const pack: ClassPack = {
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: priceForCredits(input.credits),
    status: "active",
    purchasedAt: now,
    createdAt: now,
  };

  return repos.classPacks.insert(pack);
}

export async function listPackages(repos: Repositories, memberId: string): Promise<ClassPack[]> {
  return repos.classPacks.listByMember(memberId);
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPack> {
  const pack = await repos.classPacks.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Package not found");
  return repos.classPacks.update(id, {
    creditsRemaining: 0,
    status: "refunded",
  });
}

export async function drawCreditForBooking(repos: Repositories, memberId: string): Promise<void> {
  const packs = await repos.classPacks.listByMember(memberId);

  if (!memberHasPack(packs)) {
    return;
  }

  const packToDraw = pickPackToDraw(packs);
  if (!packToDraw) {
    throw new HttpError(402, "pack_exhausted", "No available credits in your packs");
  }

  await repos.classPacks.update(packToDraw.id, {
    creditsRemaining: packToDraw.creditsRemaining - 1,
  });
}
