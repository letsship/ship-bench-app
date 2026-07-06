import type { Repositories } from "@/lib/db/repos/types";
import { dayKey } from "@/lib/domain/dates";
import { type SessionView, listSessions } from "./classes";
import type { StudioContext } from "./studio";

export interface DashboardStats {
  activeMembers: number;
  upcomingSessions: number;
  openInvoices: number;
  pendingNotifications: number;
}

export interface DashboardData {
  today: SessionView[];
  stats: DashboardStats;
}

export async function getDashboard(
  repos: Repositories,
  ctx: StudioContext,
  nowIso: string = new Date().toISOString(),
): Promise<DashboardData> {
  const todayKey = dayKey(nowIso, ctx.studio.timezone);

  const sessions = await listSessions(repos, ctx.studio.id);
  const today = sessions.filter(
    (session) => dayKey(session.startsAt, ctx.studio.timezone) === todayKey,
  );

  const [members, upcoming, invoices, pending] = await Promise.all([
    repos.members.listByStudio(ctx.studio.id),
    repos.classSessions.listByStudio(ctx.studio.id, { from: nowIso }),
    repos.invoices.listByStudio(ctx.studio.id),
    repos.outbox.listPending(),
  ]);

  return {
    today,
    stats: {
      activeMembers: members.filter((member) => member.status === "active").length,
      upcomingSessions: upcoming.length,
      openInvoices: invoices.filter((invoice) => invoice.status === "open").length,
      pendingNotifications: pending.length,
    },
  };
}
