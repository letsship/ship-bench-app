import { generateCalendarToken } from "@/lib/domain/calendar-token";
import { newId } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validation";

export async function listMembers(repos: Repositories, studioId: string): Promise<Member[]> {
  return repos.members.listByStudio(studioId);
}

export async function getMember(repos: Repositories, id: string): Promise<Member> {
  const member = await repos.members.getById(id);
  if (!member) throw new HttpError(404, "not_found", "Member not found");
  return member;
}

export async function createMember(
  repos: Repositories,
  studioId: string,
  input: CreateMemberInput,
): Promise<Member> {
  const existing = await repos.members.findByEmail(studioId, input.email);
  if (existing) {
    throw new HttpError(409, "conflict", `A member with email ${input.email} already exists`);
  }
  return repos.members.insert({
    id: newId(),
    studioId,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    status: input.status,
    notificationsOptedOut: false,
    calendarToken: generateCalendarToken(),
    createdAt: new Date().toISOString(),
  });
}

export async function updateMember(
  repos: Repositories,
  id: string,
  input: UpdateMemberInput,
): Promise<Member> {
  await getMember(repos, id);
  return repos.members.update(id, input);
}
