import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPackage } from "@/lib/db/types";
import { PRICE_PER_CREDIT_CENTS, pickPackToDraw } from "@/lib/domain/class-packs";
import { HttpError } from "@/lib/http";
import type { PurchasePackageInput } from "@/lib/validation";

export async function purchasePackage(
  repos: Repositories,
  studioId: string,
  input: PurchasePackageInput,
): Promise<ClassPackage> {
  return repos.classPackages.insert({
    id: newId(),
    studioId,
    memberId: input.memberId,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: PRICE_PER_CREDIT_CENTS,
    status: "active",
    purchasedAt: new Date().toISOString(),
  });
}

export async function listMemberPackages(
  repos: Repositories,
  memberId: string,
): Promise<ClassPackage[]> {
  return repos.classPackages.listByMember(memberId);
}

export async function refundPackage(repos: Repositories, id: string): Promise<ClassPackage> {
  const pack = await repos.classPackages.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class package not found");
  return repos.classPackages.update(id, { creditsRemaining: 0, status: "refunded" });
}

export interface CreditDraw {
  spent: boolean;
  packId: string | null;
}

// Draws one credit from the member's oldest eligible pack. A member who has
// never bought a pack is unaffected; a member whose packs are all exhausted
// or refunded is blocked with a 402 until they buy another.
export async function drawCreditForBooking(
  repos: Repositories,
  memberId: string,
): Promise<CreditDraw> {
  const packs = await repos.classPackages.listByMember(memberId);
  if (packs.length === 0) return { spent: false, packId: null };

  const packId = pickPackToDraw(packs);
  if (!packId) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member has no class pack credits left — buy another pack to keep booking",
    );
  }

  const pack = packs.find((row) => row.id === packId);
  if (!pack) throw new HttpError(402, "pack_exhausted", "Class pack not found");
  await repos.classPackages.update(packId, { creditsRemaining: pack.creditsRemaining - 1 });
  return { spent: true, packId };
}
