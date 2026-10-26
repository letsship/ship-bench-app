import { resolveStudio } from "@/lib/services/context";
import { listMembers } from "@/lib/services/members";
import { AddMemberForm } from "./add-member-form";
import { MemberDirectory } from "./member-search";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q: rawQuery } = await searchParams;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? "";
  const { repos, ctx } = await resolveStudio();
  const members = await listMembers(repos, ctx.studio.id);

  return (
    <MemberDirectory members={members} initialQuery={query} timezone={ctx.studio.timezone}>
      <AddMemberForm />
    </MemberDirectory>
  );
}
