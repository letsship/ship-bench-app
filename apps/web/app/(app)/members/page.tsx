import { formatDate } from "@/lib/format";
import { resolveStudio } from "@/lib/services/context";
import { listMembers } from "@/lib/services/members";
import { EmptyState, PageHeader, StatusBadge } from "../_components/ui";
import { AddMemberForm } from "./add-member-form";
import { OptOutToggle } from "./opt-out-toggle";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const { repos, ctx } = await resolveStudio();
  const members = await listMembers(repos, ctx.studio.id);

  return (
    <>
      <PageHeader
        title={`Members (${members.length})`}
        subtitle={`${members.length} people at the studio`}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          {members.length === 0 ? (
            <EmptyState>No members yet.</EmptyState>
          ) : (
            <div className="sb-card overflow-x-auto">
              <table className="sb-table" data-testid="members-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Notifications</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="font-medium">{member.name}</td>
                      <td className="text-[var(--color-muted)]">{member.email}</td>
                      <td>
                        <StatusBadge status={member.status} />
                      </td>
                      <td>
                        <OptOutToggle
                          memberId={member.id}
                          optedOut={member.notificationsOptedOut}
                        />
                      </td>
                      <td className="whitespace-nowrap text-[var(--color-muted)]">
                        {formatDate(member.createdAt, ctx.studio.timezone)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <AddMemberForm />
      </div>
    </>
  );
}
