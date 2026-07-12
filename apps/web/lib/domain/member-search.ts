// Pure name search over an already-fetched member list — no new data or API.

export function matchesMemberSearch(name: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return name.toLowerCase().includes(needle);
}

export function filterMembersByName<T extends { name: string }>(
  members: readonly T[],
  query: string,
): T[] {
  return members.filter((member) => matchesMemberSearch(member.name, query));
}
