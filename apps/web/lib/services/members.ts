import { newCalendarToken, newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validation";

// A member as the rest of the app may see one. `calendarToken` is a bearer
// secret — on its own it authorises /api/ical/:token — and GET /api/members
// needs no session, so the token must never ride along in a member payload.
// memberCalendarEvents is the only reader, and it goes to the repo directly.
export type MemberView = Omit<Member, "calendarToken">;

const withoutToken = ({ calendarToken: _calendarToken, ...member }: Member): MemberView => member;

export async function listMembers(repos: Repositories, studioId: string): Promise<MemberView[]> {
  return (await repos.members.listByStudio(studioId)).map(withoutToken);
}

export async function getMember(repos: Repositories, id: string): Promise<MemberView> {
  const member = await repos.members.getById(id);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  return withoutToken(member);
}

export async function createMember(
  repos: Repositories,
  studioId: string,
  input: CreateMemberInput,
): Promise<MemberView> {
  const existing = await repos.members.findByEmail(studioId, input.email);
  if (existing) {
    throw new HttpError(409, "conflict", `A member with email ${input.email} already exists`);
  }
  const member = await repos.members.insert({
    id: newId(),
    studioId,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    status: input.status,
    notificationsOptedOut: false,
    // Every member gets a private subscription secret at creation time.
    calendarToken: newCalendarToken(),
    createdAt: new Date().toISOString(),
  });
  return withoutToken(member);
}

export async function updateMember(
  repos: Repositories,
  id: string,
  input: UpdateMemberInput,
): Promise<MemberView> {
  await getMember(repos, id);
  return withoutToken(await repos.members.update(id, input));
}
