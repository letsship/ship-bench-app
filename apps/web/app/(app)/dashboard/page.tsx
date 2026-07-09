import { occupancyPercent } from "@/lib/domain/capacity";
import { formatTime } from "@/lib/format";
import { resolveStudio } from "@/lib/services/context";
import { getDashboard } from "@/lib/services/dashboard";
import { EmptyState, StatCard, StatusBadge } from "../_components/ui";
import { TodayHeading } from "./today-heading";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { repos, ctx } = await resolveStudio();
  const { today, todayLabel, stats } = await getDashboard(repos, ctx);
  const timeZone = ctx.studio.timezone;

  return (
    <>
      <TodayHeading subtitle={todayLabel} />

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
