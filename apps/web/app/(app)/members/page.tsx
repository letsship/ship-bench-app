import { resolveStudio } from "@/lib/services/context";
import { listMembers } from "@/lib/services/members";
import { PageHeader } from "../_components/ui";
import { AddMemberForm } from "./add-member-form";
import { MembersTable } from "./members-table";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const { repos, ctx } = await resolveStudio();
  const members = await listMembers(repos, ctx.studio.id);

  return (
    <>
      <PageHeader title="Members" subtitle={`${members.length} people at the studio`} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <MembersTable members={members} timezone={ctx.studio.timezone} />
        </div>
        <AddMemberForm />
      </div>
    </>
  );
}
