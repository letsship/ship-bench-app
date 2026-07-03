import { and, eq, gte, isNull } from "drizzle-orm";
import { classSessions, invoices, members, notificationOutbox } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { dayKey } from "@/lib/domain/dates";
import { listSessions, type SessionView } from "./classes";
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

async function countRows(db: Db, query: Promise<{ id: string }[]>): Promise<number> {
  return (await query).length;
}

export async function getDashboard(db: Db, ctx: StudioContext): Promise<DashboardData> {
  const nowIso = new Date().toISOString();
  const todayKey = dayKey(nowIso, ctx.studio.timezone);

  const sessions = await listSessions(db, ctx.studio.id);
  const today = sessions.filter(
    (session) => dayKey(session.startsAt, ctx.studio.timezone) === todayKey,
  );

  const [activeMembers, upcomingSessions, openInvoices, pendingNotifications] = await Promise.all([
    countRows(
      db,
      db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.studioId, ctx.studio.id), eq(members.status, "active"))),
    ),
    countRows(
      db,
      db
        .select({ id: classSessions.id })
        .from(classSessions)
        .where(and(eq(classSessions.studioId, ctx.studio.id), gte(classSessions.startsAt, nowIso))),
    ),
    countRows(
      db,
      db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.studioId, ctx.studio.id), eq(invoices.status, "open"))),
    ),
    countRows(
      db,
      db
        .select({ id: notificationOutbox.id })
        .from(notificationOutbox)
        .where(isNull(notificationOutbox.sentAt)),
    ),
  ]);

  return {
    today,
    stats: { activeMembers, upcomingSessions, openInvoices, pendingNotifications },
  };
}
