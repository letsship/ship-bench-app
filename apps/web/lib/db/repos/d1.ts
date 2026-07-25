import type { D1Database } from "@cloudflare/workers-types";
import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/d1";
import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  InvoiceLineItem,
  Member,
  NotificationOutboxRow,
  Studio,
  StudioSettings,
} from "../types";
import * as schema from "../schema";
import type { Repositories } from "./types";

// Production repository implementation over Drizzle ORM + Cloudflare D1.
// This implementation mirrors the Supabase semantics exactly: name ordering for
// members/classTypes, startsAt ordering with optional range filtering for sessions,
// issuedAt-descending for invoices, etc. The query builder is typed against
// drizzle-orm/sqlite-core so the same code can run under better-sqlite3 in tests.

export function createD1Repositories(
  db: D1Database | BaseSQLiteDatabase<"sync" | "async", typeof schema>,
): Repositories {
  const qb = "select" in db ? db : drizzle(db, { schema });

  return {
    studios: {
      getFirst: async () => {
        const result = await qb.select().from(schema.studios).limit(1);
        return result.length > 0 ? (result[0] as Studio) : null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const result = await qb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return result.length > 0 ? (result[0] as StudioSettings) : null;
      },
      update: async (studioId, patch) => {
        const updates: Record<string, unknown> = {};
        if (patch.currency !== undefined) updates.currency = patch.currency;
        if (patch.taxRateBps !== undefined) updates.taxRateBps = patch.taxRateBps;
        if (patch.cancellationWindowHours !== undefined)
          updates.cancellationWindowHours = patch.cancellationWindowHours;
        if (patch.waitlistEnabled !== undefined) updates.waitlistEnabled = patch.waitlistEnabled;
        if (patch.notifyBookingConfirmations !== undefined)
          updates.notifyBookingConfirmations = patch.notifyBookingConfirmations;
        if (patch.notifyCancellations !== undefined)
          updates.notifyCancellations = patch.notifyCancellations;
        if (patch.notifyWaitlistPromotions !== undefined)
          updates.notifyWaitlistPromotions = patch.notifyWaitlistPromotions;
        if (patch.notifyInvoices !== undefined) updates.notifyInvoices = patch.notifyInvoices;

        const result = await qb
          .update(schema.studioSettings)
          .set(updates)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return result[0] as StudioSettings;
      },
    },
    members: {
      listByStudio: async (studioId) => {
        const results = await qb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
        return results as Member[];
      },
      getById: async (id) => {
        const result = await qb.select().from(schema.members).where(eq(schema.members.id, id));
        return result.length > 0 ? (result[0] as Member) : null;
      },
      findByEmail: async (studioId, email) => {
        const result = await qb
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return result.length > 0 ? (result[0] as Member) : null;
      },
      insert: async (member) => {
        const result = await qb
          .insert(schema.members)
          .values(member as any)
          .returning();
        return result[0] as Member;
      },
      update: async (id, patch) => {
        const updates: Record<string, unknown> = {};
        if (patch.name !== undefined) updates.name = patch.name;
        if (patch.email !== undefined) updates.email = patch.email;
        if (patch.phone !== undefined) updates.phone = patch.phone;
        if (patch.status !== undefined) updates.status = patch.status;
        if (patch.notificationsOptedOut !== undefined)
          updates.notificationsOptedOut = patch.notificationsOptedOut;

        const result = await qb
          .update(schema.members)
          .set(updates)
          .where(eq(schema.members.id, id))
          .returning();
        return result[0] as Member;
      },
    },
    classTypes: {
      listByStudio: async (studioId) => {
        const results = await qb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
        return results as ClassType[];
      },
      getById: async (id) => {
        const result = await qb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return result.length > 0 ? (result[0] as ClassType) : null;
      },
      insert: async (classType) => {
        const result = await qb
          .insert(schema.classTypes)
          .values(classType as any)
          .returning();
        return result[0] as ClassType;
      },
    },
    classSessions: {
      listByStudio: async (studioId, range = {}) => {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) {
          conditions.push(gte(schema.classSessions.startsAt, range.from));
        }
        if (range.to) {
          conditions.push(lt(schema.classSessions.startsAt, range.to));
        }
        const results = await qb
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
        return results as ClassSession[];
      },
      getById: async (id) => {
        const result = await qb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return result.length > 0 ? (result[0] as ClassSession) : null;
      },
      insert: async (session) => {
        const result = await qb
          .insert(schema.classSessions)
          .values(session as any)
          .returning();
        return result[0] as ClassSession;
      },
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        const results = await qb
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
        return results as Booking[];
      },
      listBySession: async (sessionId) => {
        const results = await qb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
        return results as Booking[];
      },
      getById: async (id) => {
        const result = await qb.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return result.length > 0 ? (result[0] as Booking) : null;
      },
      insert: async (booking) => {
        const result = await qb
          .insert(schema.bookings)
          .values(booking as any)
          .returning();
        return result[0] as Booking;
      },
      update: async (id, patch) => {
        const updates: Record<string, unknown> = {};
        if (patch.status !== undefined) updates.status = patch.status;
        if (patch.bookedAt !== undefined) updates.bookedAt = patch.bookedAt;
        if (patch.cancelledAt !== undefined) updates.cancelledAt = patch.cancelledAt;

        const result = await qb
          .update(schema.bookings)
          .set(updates)
          .where(eq(schema.bookings.id, id))
          .returning();
        return result[0] as Booking;
      },
    },
    invoices: {
      listByStudio: async (studioId) => {
        const results = await qb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
        return results as Invoice[];
      },
      getById: async (id) => {
        const result = await qb.select().from(schema.invoices).where(eq(schema.invoices.id, id));
        return result.length > 0 ? (result[0] as Invoice) : null;
      },
      countByStudio: async (studioId) => {
        const result = await qb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return result.length;
      },
      insert: async (invoice) => {
        const result = await qb
          .insert(schema.invoices)
          .values(invoice as any)
          .returning();
        return result[0] as Invoice;
      },
      update: async (id, patch) => {
        const updates: Record<string, unknown> = {};
        if (patch.status !== undefined) updates.status = patch.status;
        if (patch.paidAt !== undefined) updates.paidAt = patch.paidAt;

        const result = await qb
          .update(schema.invoices)
          .set(updates)
          .where(eq(schema.invoices.id, id))
          .returning();
        return result[0] as Invoice;
      },
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) => {
        const results = await qb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
        return results as InvoiceLineItem[];
      },
      insertMany: async (items) => {
        if (items.length === 0) return [];
        const result = await qb
          .insert(schema.invoiceLineItems)
          .values(items as any)
          .returning();
        return result as InvoiceLineItem[];
      },
    },
    outbox: {
      insert: async (row) => {
        const result = await qb
          .insert(schema.notificationOutbox)
          .values(row as any)
          .returning();
        return result[0] as NotificationOutboxRow;
      },
      listPending: async () => {
        const results = await qb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
        return results as NotificationOutboxRow[];
      },
      update: async (id, patch) => {
        const updates: Record<string, unknown> = {};
        if (patch.sentAt !== undefined) updates.sentAt = patch.sentAt;
        if (patch.providerMessageId !== undefined)
          updates.providerMessageId = patch.providerMessageId;
        if (patch.error !== undefined) updates.error = patch.error;

        const result = await qb
          .update(schema.notificationOutbox)
          .set(updates)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return result[0] as NotificationOutboxRow;
      },
    },
  };
}
