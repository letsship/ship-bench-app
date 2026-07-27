import { drizzle } from "drizzle-orm/d1";
import { asc, count, desc, eq, inArray, isNull, and, gte, lt } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
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

// Production repository implementation over Drizzle + Cloudflare D1.
// Reads come back with camelCase property names (defined in schema.ts) and are
// returned as domain entities; writes take domain entities and insert them
// directly (the schema handles property-name-to-column-name mapping).
// This is the ONE file a Supabase→D1 migration replaces — nothing above the
// repository interface changes.

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  async function maybeOne<T>(fn: () => Promise<T[]>): Promise<T | null> {
    const results = await fn();
    return results[0] ?? null;
  }

  return {
    studios: {
      getFirst: () =>
        maybeOne(() =>
          drizzleDb
            .select()
            .from(schema.studios)
            .limit(1)
            .then((rows) => rows as Studio[]),
        ),
    },

    settings: {
      getByStudioId: (studioId) =>
        maybeOne(() =>
          drizzleDb
            .select()
            .from(schema.studioSettings)
            .where(eq(schema.studioSettings.studioId, studioId))
            .then((rows) => rows as StudioSettings[]),
        ),

      update: async (studioId, patch) => {
        const updated = await drizzleDb
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        if (!updated[0]) throw new Error(`settings.update: row not found for ${studioId}`);
        return updated[0] as StudioSettings;
      },
    },

    members: {
      listByStudio: (studioId) =>
        drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name))
          .then((rows) => rows as Member[]),

      getById: (id) =>
        maybeOne(() =>
          drizzleDb
            .select()
            .from(schema.members)
            .where(eq(schema.members.id, id))
            .then((rows) => rows as Member[]),
        ),

      findByEmail: (studioId, email) =>
        maybeOne(() =>
          drizzleDb
            .select()
            .from(schema.members)
            .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
            .then((rows) => rows as Member[]),
        ),

      insert: async (member) => {
        const inserted = await drizzleDb.insert(schema.members).values(member).returning();
        if (!inserted[0]) throw new Error("members.insert: no row returned");
        return inserted[0] as Member;
      },

      update: async (id, patch) => {
        const updated = await drizzleDb
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        if (!updated[0]) throw new Error(`members.update: row not found for ${id}`);
        return updated[0] as Member;
      },
    },

    classTypes: {
      listByStudio: (studioId) =>
        drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name))
          .then((rows) => rows as ClassType[]),

      getById: (id) =>
        maybeOne(() =>
          drizzleDb
            .select()
            .from(schema.classTypes)
            .where(eq(schema.classTypes.id, id))
            .then((rows) => rows as ClassType[]),
        ),

      insert: async (classType) => {
        const inserted = await drizzleDb.insert(schema.classTypes).values(classType).returning();
        if (!inserted[0]) throw new Error("classTypes.insert: no row returned");
        return inserted[0] as ClassType;
      },
    },

    classSessions: {
      listByStudio: async (studioId, range = {}) => {
        let query = drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.studioId, studioId));

        if (range.from || range.to) {
          const conditions = [];
          if (range.from) {
            conditions.push(gte(schema.classSessions.startsAt, range.from));
          }
          if (range.to) {
            conditions.push(lt(schema.classSessions.startsAt, range.to));
          }
          query = drizzleDb
            .select()
            .from(schema.classSessions)
            .where(and(eq(schema.classSessions.studioId, studioId), ...conditions));
        }

        return query
          .orderBy(asc(schema.classSessions.startsAt))
          .then((rows) => rows as ClassSession[]);
      },

      getById: (id) =>
        maybeOne(() =>
          drizzleDb
            .select()
            .from(schema.classSessions)
            .where(eq(schema.classSessions.id, id))
            .then((rows) => rows as ClassSession[]),
        ),

      insert: async (session) => {
        const inserted = await drizzleDb.insert(schema.classSessions).values(session).returning();
        if (!inserted[0]) throw new Error("classSessions.insert: no row returned");
        return inserted[0] as ClassSession;
      },
    },

    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return drizzleDb
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds))
          .then((rows) => rows as Booking[]);
      },

      listBySession: (sessionId) =>
        drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId))
          .then((rows) => rows as Booking[]),

      getById: (id) =>
        maybeOne(() =>
          drizzleDb
            .select()
            .from(schema.bookings)
            .where(eq(schema.bookings.id, id))
            .then((rows) => rows as Booking[]),
        ),

      insert: async (booking) => {
        const inserted = await drizzleDb.insert(schema.bookings).values(booking).returning();
        if (!inserted[0]) throw new Error("bookings.insert: no row returned");
        return inserted[0] as Booking;
      },

      update: async (id, patch) => {
        const updated = await drizzleDb
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        if (!updated[0]) throw new Error(`bookings.update: row not found for ${id}`);
        return updated[0] as Booking;
      },
    },

    invoices: {
      listByStudio: (studioId) =>
        drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt))
          .then((rows) => rows as Invoice[]),

      getById: (id) =>
        maybeOne(() =>
          drizzleDb
            .select()
            .from(schema.invoices)
            .where(eq(schema.invoices.id, id))
            .then((rows) => rows as Invoice[]),
        ),

      countByStudio: async (studioId) => {
        const result = await drizzleDb
          .select({ count: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return result[0]?.count ?? 0;
      },

      insert: async (invoice) => {
        const inserted = await drizzleDb.insert(schema.invoices).values(invoice).returning();
        if (!inserted[0]) throw new Error("invoices.insert: no row returned");
        return inserted[0] as Invoice;
      },

      update: async (id, patch) => {
        const updated = await drizzleDb
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        if (!updated[0]) throw new Error(`invoices.update: row not found for ${id}`);
        return updated[0] as Invoice;
      },
    },

    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        drizzleDb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId))
          .then((rows) => rows as InvoiceLineItem[]),

      insertMany: async (items) => {
        if (items.length === 0) return [];
        const inserted = await drizzleDb.insert(schema.invoiceLineItems).values(items).returning();
        return inserted as InvoiceLineItem[];
      },
    },

    outbox: {
      insert: async (row) => {
        const inserted = await drizzleDb.insert(schema.notificationOutbox).values(row).returning();
        if (!inserted[0]) throw new Error("outbox.insert: no row returned");
        return inserted[0] as NotificationOutboxRow;
      },

      listPending: () =>
        drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt))
          .then((rows) => rows as NotificationOutboxRow[]),

      update: async (id, patch) => {
        const updated = await drizzleDb
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        if (!updated[0]) throw new Error(`outbox.update: row not found for ${id}`);
        return updated[0] as NotificationOutboxRow;
      },
    },
  };
}
