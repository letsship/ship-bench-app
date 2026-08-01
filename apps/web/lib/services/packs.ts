import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { ClassPack } from "@/lib/db/types";
import { ownsAnyPack, packPriceCents, pickPackToDraw } from "@/lib/domain/packs";
import { HttpError } from "@/lib/http";
import type { CreatePackageInput } from "@/lib/validation";

interface PackView {
  id: string;
  creditsTotal: number;
  creditsRemaining: number;
  priceCents: number;
  status: ClassPack["status"];
  purchasedAt: string;
}

interface CreatedPackView extends PackView {
  memberId: string;
}

function toPackView(pack: ClassPack): PackView {
  return {
    id: pack.id,
    creditsTotal: pack.creditsTotal,
    creditsRemaining: pack.creditsRemaining,
    priceCents: pack.priceCents,
    status: pack.status,
    purchasedAt: pack.purchasedAt,
  };
}

function toCreatedPackView(pack: ClassPack): CreatedPackView {
  return { memberId: pack.memberId, ...toPackView(pack) };
}

export async function createPack(
  repos: Repositories,
  studioId: string,
  input: CreatePackageInput,
): Promise<CreatedPackView> {
  const member = await repos.members.getById(input.memberId);
  if (!member || member.studioId !== studioId) {
    throw new HttpError(400, "bad_request", "Unknown member for this class pack");
  }

  const purchasedAt = new Date().toISOString();
  const pack = await repos.packs.insert({
    id: newId(),
    studioId,
    memberId: member.id,
    creditsTotal: input.credits,
    creditsRemaining: input.credits,
    priceCents: packPriceCents(input.credits),
    status: "active",
    purchasedAt,
    createdAt: purchasedAt,
  });
  return toCreatedPackView(pack);
}

export async function listPacks(repos: Repositories, memberId: string): Promise<PackView[]> {
  const packs = await repos.packs.listByMember(memberId);
  return [...packs].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)).map(toPackView);
}

export async function refundPack(repos: Repositories, id: string): Promise<CreatedPackView> {
  const pack = await repos.packs.getById(id);
  if (!pack) throw new HttpError(404, "not_found", "Class pack not found");
  return toCreatedPackView(
    await repos.packs.update(id, { creditsRemaining: 0, status: "refunded" }),
  );
}

export async function drawCreditForPack(
  repos: Repositories,
  memberId: string,
): Promise<ClassPack | null> {
  const packs = await repos.packs.listByMember(memberId);
  if (!ownsAnyPack(packs)) return null;

  const pack = pickPackToDraw(packs);
  if (!pack) {
    throw new HttpError(
      402,
      "pack_exhausted",
      "This member has no class pack credits remaining",
    );
  }
  return repos.packs.update(pack.id, { creditsRemaining: pack.creditsRemaining - 1 });
}
