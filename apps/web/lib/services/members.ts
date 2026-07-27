import { newId, newCalendarToken } from "@/lib/db/ids";
import type { Repositories } from "@/lib/db/repos/types";
import type { Member } from "@/lib/db/types";
import { HttpError } from "@/lib/http";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validation";
import type { CalendarEvent } from "@/lib/domain/ical";

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
    calendarToken: newCalendarToken(),
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

export async function getMemberCalendarFeed(
  repos: Repositories,
  token: string,
  now?: string,
): Promise<{ member: Member; events: CalendarEvent[] }> {
  const trimmed = token?.trim() ?? "";
  if (!trimmed) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }
  const member = await repos.members.findByCalendarToken(trimmed);
  if (!member) {
    throw new HttpError(404, "not_found", "Calendar token not found");
  }
  const { memberCalendarEvents } = await import("@/lib/domain/member-calendar");
  const nowTime = now ?? new Date().toISOString();
  const sessions = await repos.classSessions.listByStudio(member.studioId, {
    from: nowTime,
  });
  const classTypes = await repos.classTypes.listByStudio(member.studioId);
  const typeById = new Map(classTypes.map((type) => [type.id, type]));
  const bookings = await repos.bookings.listBySessionIds(sessions.map((s) => s.id));
  const events = memberCalendarEvents(
    member.id,
    nowTime,
    sessions.map((s) => ({ ...s, classTypeName: typeById.get(s.classTypeId)?.name ?? "Class" })),
    bookings,
  );
  return { member, events };
}
