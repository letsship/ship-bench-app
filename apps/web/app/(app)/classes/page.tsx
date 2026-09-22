import { occupancyPercent } from "@/lib/domain/capacity";
import { groupByDay } from "@/lib/domain/dates";
import { formatDayLabel, formatTime } from "@/lib/format";
import { listClassTypes, listSessions } from "@/lib/services/classes";
import { resolveStudio } from "@/lib/services/context";
import { EmptyState, PageHeader, StatusBadge } from "../_components/ui";
import { AddClassForm } from "./add-class-form";
import { CancelClassButton } from "./cancel-class-button";

export const dynamic = "force-dynamic";

const CANCELLABLE = (session: { status: string; startsAt: string }): boolean => {
  return session.status === "scheduled" && new Date() < new Date(session.startsAt);
};

export default async function ClassesPage() {
  const { repos, ctx } = await resolveStudio();
  const timeZone = ctx.studio.timezone;
  const now = new Date().toISOString();
  const [sessions, classTypes] = await Promise.all([
    listSessions(repos, ctx.studio.id, { from: now }),
    listClassTypes(repos, ctx.studio.id),
  ]);
  const days = groupByDay(sessions, (session) => session.startsAt, timeZone);

  return (
    <>
      <PageHeader title="Classes" subtitle="Your upcoming schedule and occupancy." />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6" data-testid="schedule">
          {days.length === 0 ? (
            <EmptyState>No upcoming classes — schedule one to get started.</EmptyState>
          ) : (
            days.map((day) => (
              <section key={day.day}>
                <h2 className="mb-2 text-sm font-semibold text-[var(--color-muted)]">
                  {formatDayLabel(day.items[0].startsAt, timeZone)}
                </h2>
                <div className="sb-card overflow-x-auto">
                  <table className="sb-table">
                    <tbody>
                      {day.items.map((session) => (
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
                          <td className="text-[var(--color-muted)]">{session.instructor}</td>
                          <td className="whitespace-nowrap">
                            {session.occupancy.booked}/{session.occupancy.capacity} booked
                            <span className="ml-2 text-[var(--color-muted)]">
                              ({occupancyPercent(session.occupancy)}%)
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={session.status} />
                          </td>
                          <td className="text-right">
                            {CANCELLABLE(session) ? (
                              <CancelClassButton sessionId={session.id} />
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </div>
        <AddClassForm
          classTypes={classTypes.map((type) => ({
            id: type.id,
            name: type.name,
            defaultCapacity: type.defaultCapacity,
            defaultPriceCents: type.defaultPriceCents,
          }))}
        />
      </div>
    </>
  );
}
