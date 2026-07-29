import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../schema";
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
import type { Repositories } from "./types";

// The production repository implementation over Cloudflare D1 (the Worker's own
// SQLite database binding) via Drizzle ORM. `db` is the raw D1 binding; Drizzle
// wraps it and the schema object maps the snake_case columns to the camelCase
// entity keys, so no manual column mapping is needed. Every method mirrors the
// behaviour of the old Supabase adapter one-for-one (filters, orderings,
// empty-input guards, count, returning). Services set ids + timestamps
// app-side, so inserts are fully-formed rows and read-back is identity.

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  return {
    studios: {
      getFirst: async () => {
        const rows = await drizzleDb.select().from(schema.studios).limit(1);
        return rows[0] ?? null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const rows = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return rows[0] ?? null;
      },
      update: async (studioId, patch) => {
        const rows = await drizzleDb
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        const row = rows[0];
        if (!row) throw new Error(`studio_settings update failed: ${studioId} not found`);
        return row;
      },
    },
    members: {
      listByStudio: async (studioId) =>
        drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name)),
      getById: async (id) => {
        const rows = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id));
        return rows[0] ?? null;
      },
      findByEmail: async (studioId, email) => {
        const rows = await drizzleDb
          .select()
          .from(schema.members)
          .where(
            and(
              eq(schema.members.studioId, studioId),
              eq(schema.members.email, email),
            ),
          );
        return rows[0] ?? null;
      },
      insert: async (member) => {
        const rows = await drizzleDb
          .insert(schema.members)
          .values(member)
          .returning();
        return rows[0];
      },
      update: async (id, patch) => {
        const rows = await drizzleDb
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        const row = rows[0];
        if (!row) throw new Error(`members update failed: ${id} not found`);
        return row;
      },
    },
    classTypes: {
      listByStudio: async (studioId) =>
        drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name)),
      getById: async (id) => {
        const rows = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return rows[0] ?? null;
      },
      insert: async (classType) => {
        const rows = await drizzleDb
          .insert(schema.classTypes)
          .values(classType)
          .returning();
        return rows[0];
      },
    },
    classSessions: {
      listByStudio: async (studioId, range = {}) => {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return drizzleDb
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
      },
      getById: async (id) => {
        const rows = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return rows[0] ?? null;
      },
      insert: async (session) => {
        const rows = await drizzleDb
          .insert(schema.classSessions)
          .values(session)
          .returning();
        return rows[0];
      },
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return drizzleDb
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      listBySession: async (sessionId) =>
        drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId)),
      getById: async (id) => {
        const rows = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id));
        return rows[0] ?? null;
      },
      insert: async (booking) => {
        const rows = await drizzleDb
          .insert(schema.bookings)
          .values(booking)
          .returning();
        return rows[0];
      },
      update: async (id, patch) => {
        const rows = await drizzleDb
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        const row = rows[0];
        if (!row) throw new Error(`bookings update failed: ${id} not found`);
        return row;
      },
    },
    invoices: {
      listByStudio: async (studioId) =>
        drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt)),
      getById: async (id) => {
        const rows = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id));
        return rows[0] ?? null;
      },
      countByStudio: async (studioId) => {
        return drizzleDb.$count(schema.invoices, eq(schema.invoices.studioId, studioId));
      },
      insert: async (invoice) => {
        const rows = await drizzleDb
          .insert(schema.invoices)
          .values(invoice)
          .returning();
        return rows[0];
      },
      update: async (id, patch) => {
        const rows = await drizzleDb
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        const row = rows[0];
        if (!row) throw new Error(`invoices update failed: ${id} not found`);
        return row;
      },
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) =>
        drizzleDb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId)),
      insertMany: async (items) => {
        if (items.length === 0) return [];
        return drizzleDb
          .insert(schema.invoiceLineItems)
          .values(items)
          .returning();
      },
    },
    outbox: {
      insert: async (row) => {
        const rows = await drizzleDb
          .insert(schema.notificationOutbox)
          .values(row)
          .returning();
        return rows[0];
      },
      listPending: async () =>
        drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt)),
      update: async (id, patch) => {
        const rows = await drizzleDb
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        const row = rows[0];
        if (!row) throw new Error(`notification_outbox update failed: ${id} not found`);
        return row;
      },
    },
  };
}
