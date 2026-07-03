import { groupByDay } from "@/lib/domain/dates";
import { formatDayLabel, formatTime } from "@/lib/format";
import { listBookingRows } from "@/lib/services/booking-list";
import { listSessions } from "@/lib/services/classes";
import { resolveStudio } from "@/lib/services/context";
import { listMembers } from "@/lib/services/members";
import { EmptyState, PageHeader, StatusBadge } from "../_components/ui";
import { CancelButton } from "./cancel-button";
import { NewBookingForm } from "./new-booking-form";

export const dynamic = "force-dynamic";

const CANCELLABLE = new Set(["booked", "waitlisted"]);

export default async function BookingsPage() {
  const { db, ctx } = await resolveStudio();
  const timeZone = ctx.studio.timezone;
  const nowIso = new Date().toISOString();
  const [rows, sessions, members] = await Promise.all([
    listBookingRows(db, ctx.studio.id, { from: nowIso }),
    listSessions(db, ctx.studio.id, { from: nowIso }),
    listMembers(db, ctx.studio.id),
  ]);
  const days = groupByDay(rows, (row) => row.startsAt, timeZone);

  return (
    <>
      <PageHeader title="Bookings" subtitle="Upcoming bookings by day." />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6" data-testid="bookings">
          {days.length === 0 ? (
            <EmptyState>No upcoming bookings.</EmptyState>
          ) : (
            days.map((day) => (
              <section key={day.day}>
                <h2 className="mb-2 text-sm font-semibold text-[var(--color-muted)]">
                  {formatDayLabel(day.items[0].startsAt, timeZone)}
                </h2>
                <div className="sb-card overflow-x-auto">
                  <table className="sb-table">
                    <tbody>
                      {day.items.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap font-medium">
                            {formatTime(row.startsAt, timeZone)}
                          </td>
                          <td>{row.className}</td>
                          <td>{row.memberName}</td>
                          <td>
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="text-right">
                            {CANCELLABLE.has(row.status) ? (
                              <CancelButton bookingId={row.id} />
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
        <NewBookingForm
          sessions={sessions.map((session) => ({
            id: session.id,
            label: `${session.classTypeName} · ${formatTime(session.startsAt, timeZone)}`,
          }))}
          members={members.map((member) => ({ id: member.id, name: member.name }))}
        />
      </div>
    </>
  );
}
