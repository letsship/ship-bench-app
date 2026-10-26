import type { Member } from "@/lib/db/types";

type Searchable = Pick<Member, "name" | "email">;

function normaliseQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesMemberQuery(member: Searchable, query: string): boolean {
  const needle = normaliseQuery(query);
  return member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle);
}

export function filterMembers<T extends Searchable>(members: T[], query: string): T[] {
  return members.filter((member) => matchesMemberQuery(member, query));
}

export function membersSubtitle(matched: number, total: number, query: string): string {
  if (!normaliseQuery(query)) return `${total} people at the studio`;
  return `${matched} of ${total} people`;
}
