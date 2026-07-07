import { occupancyPercent } from "@/lib/domain/capacity";
import { formatDayLabel, formatTime } from "@/lib/format";
import { resolveStudio } from "@/lib/services/context";
import { getDashboard } from "@/lib/services/dashboard";
import { getRequestNowIso } from "@/lib/services/request-time";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { repos, ctx } = await resolveStudio();
  // Compute "now" exactly once for the whole request so the header date and
  // the "today" session list are derived from the same instant — independent
  // `new Date()` reads can drift across Next.js's internal render passes and
  // cause a hydration mismatch / date flip near studio-timezone midnight.
  const nowIso = getRequestNowIso();
  const { today, stats } = await getDashboard(repos, ctx, nowIso);
  const timeZone = ctx.studio.timezone;
  const todayLabel = formatDayLabel(nowIso, timeZone);

  return (
    <>
      <PageHeader title="Today at the studio" subtitle={todayLabel} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active members" value={stats.activeMembers} />
        <StatCard label="Upcoming classes" value={stats.upcomingSessions} />
        <StatCard label="Open invoices" value={stats.openInvoices} />
        <StatCard label="Pending notices" value={stats.pendingNotifications} />
      </div>

      <h2 className="mb-3 mt-10 text-xl">Today&rsquo;s classes</h2>
      {today.length === 0 ? (
        <EmptyState>No classes scheduled today.</EmptyState>
      ) : (
        <div className="sb-card overflow-hidden">
          <table className="sb-table" data-testid="today-classes">
            <thead>
              <tr>
                <th>Time</th>
                <th>Class</th>
                <th>Instructor</th>
                <th>Occupancy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {today.map((session) => (
                <tr key={session.id}>
                  <td className="whitespace-nowrap font-medium">
                    {formatTime(session.startsAt, timeZone)}
                  </td>
                  <td>
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ backgroundColor: session.classTypeColor }}
                    />
                    {session.classTypeName}
                  </td>
                  <td>{session.instructor}</td>
                  <td>
                    {session.occupancy.booked}/{session.occupancy.capacity}
                    <span className="ml-2 text-[var(--color-muted)]">
                      ({occupancyPercent(session.occupancy)}%)
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={session.occupancy.isFull ? "waitlisted" : "booked"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
