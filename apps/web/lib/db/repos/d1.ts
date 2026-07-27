import { and, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
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
import * as schema from "./schema";
import type { Repositories } from "./types";

// Production repository implementation over Drizzle + D1.
// The D1Database binding's prepare/bind/all/run/first methods are wrapped
// by drizzle(); all reads/writes go through Drizzle's query builder.
// Column names in the schema are snake_case and automatically map to
// camelCase entity fields via Drizzle's column helpers (e.g., integer mode: 'boolean').

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  return {
    studios: {
      getFirst: async () => {
        const result = (await drizzleDb.select().from(schema.studios)) as Studio[];
        return result[0] ?? null;
      },
    },

    settings: {
      getByStudioId: async (studioId) => {
        const result = (await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId))) as StudioSettings[];
        return result[0] ?? null;
      },
      update: async (studioId, patch) => {
        const result = (await drizzleDb
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning()) as StudioSettings[];
        return result[0] as StudioSettings;
      },
    },

    members: {
      listByStudio: async (studioId) => {
        const rows = (await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name)) as Member[];
        return rows;
      },
      getById: async (id) => {
        const result = (await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))) as Member[];
        return result[0] ?? null;
      },
      findByEmail: async (studioId, email) => {
        const result = (await drizzleDb
          .select()
          .from(schema.members)
          .where(
            and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)),
          )) as Member[];
        return result[0] ?? null;
      },
      insert: async (member) => {
        const result = (await drizzleDb
          .insert(schema.members)
          .values(member)
          .returning()) as Member[];
        return result[0] as Member;
      },
      update: async (id, patch) => {
        const result = (await drizzleDb
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning()) as Member[];
        return result[0] as Member;
      },
    },

    classTypes: {
      listByStudio: async (studioId) => {
        const rows = (await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name)) as ClassType[];
        return rows;
      },
      getById: async (id) => {
        const result = (await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id))) as ClassType[];
        return result[0] ?? null;
      },
      insert: async (classType) => {
        const result = (await drizzleDb
          .insert(schema.classTypes)
          .values(classType)
          .returning()) as ClassType[];
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

        const rows = (await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.startsAt)) as ClassSession[];
        return rows;
      },
      getById: async (id) => {
        const result = (await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id))) as ClassSession[];
        return result[0] ?? null;
      },
      insert: async (session) => {
        const result = (await drizzleDb
          .insert(schema.classSessions)
          .values(session)
          .returning()) as ClassSession[];
        return result[0] as ClassSession;
      },
    },

    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        const rows = (await drizzleDb
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds))) as Booking[];
        return rows;
      },
      listBySession: async (sessionId) => {
        const rows = (await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId))) as Booking[];
        return rows;
      },
      getById: async (id) => {
        const result = (await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id))) as Booking[];
        return result[0] ?? null;
      },
      insert: async (booking) => {
        const result = (await drizzleDb
          .insert(schema.bookings)
          .values(booking)
          .returning()) as Booking[];
        return result[0] as Booking;
      },
      update: async (id, patch) => {
        const result = (await drizzleDb
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning()) as Booking[];
        return result[0] as Booking;
      },
    },

    invoices: {
      listByStudio: async (studioId) => {
        const rows = (await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt))) as Invoice[];
        return rows;
      },
      getById: async (id) => {
        const result = (await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id))) as Invoice[];
        return result[0] ?? null;
      },
      countByStudio: async (studioId) => {
        const result = (await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))) as Invoice[];
        return result.length;
      },
      insert: async (invoice) => {
        const result = (await drizzleDb
          .insert(schema.invoices)
          .values(invoice)
          .returning()) as Invoice[];
        return result[0] as Invoice;
      },
      update: async (id, patch) => {
        const result = (await drizzleDb
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning()) as Invoice[];
        return result[0] as Invoice;
      },
    },

    invoiceLineItems: {
      listByInvoice: async (invoiceId) => {
        const rows = (await drizzleDb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId))) as InvoiceLineItem[];
        return rows;
      },
      insertMany: async (items) => {
        if (items.length === 0) return [];
        const result = (await drizzleDb
          .insert(schema.invoiceLineItems)
          .values(items)
          .returning()) as InvoiceLineItem[];
        return result;
      },
    },

    outbox: {
      insert: async (row) => {
        const result = (await drizzleDb
          .insert(schema.notificationOutbox)
          .values(row)
          .returning()) as NotificationOutboxRow[];
        return result[0] as NotificationOutboxRow;
      },
      listPending: async () => {
        const rows = (await drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt))) as NotificationOutboxRow[];
        return rows;
      },
      update: async (id, patch) => {
        const result = (await drizzleDb
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning()) as NotificationOutboxRow[];
        return result[0] as NotificationOutboxRow;
      },
    },
  };
}
