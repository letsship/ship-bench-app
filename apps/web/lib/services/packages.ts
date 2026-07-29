import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { packPriceCents, pickPackToDeduct } from "@/lib/domain/packages";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

const nowIso = (): string => new Date().toISOString();

export async function createPackage(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<ClassPack> {
  const pack: ClassPack = {
    id: newId(),
    studioId,
    memberId: input.memberId,
    credits: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    createdAt: nowIso(),
  };
  return repos.classPacks.insert(pack);
}

export async function listActivePackages(
  repos: Repositories,
  memberId: string,
): Promise<ClassPack[]> {
  return repos.classPacks.listActiveByMember(memberId);
}

export async function spendCreditForBooking(repos: Repositories, memberId: string): Promise<void> {
  const activePacks = await repos.classPacks.listActiveByMember(memberId);

  if (activePacks.length === 0) return;

  const packToDeduct = pickPackToDeduct(activePacks);
  if (!packToDeduct) {
    throw new HttpError(402, "no_credits", "No credits remaining — buy a pack");
  }

  await repos.classPacks.update(packToDeduct.id, {
    creditsRemaining: packToDeduct.creditsRemaining - 1,
  });
}
