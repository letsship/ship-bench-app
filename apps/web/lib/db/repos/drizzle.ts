import { and, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { getDb } from "../drizzle/client";
import {
  bookings,
  classSessions,
  classTypes,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  studioSettings,
  studios,
} from "../drizzle/schema";
import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  InvoiceLineItem,
  Member,
  NotificationOutboxRow,
  StudioSettings,
} from "../types";
import type { Repositories } from "./types";

// The production repository implementation over Drizzle ORM + the Cloudflare D1
// binding. This is the ONE file a Supabase→D1 migration rewrites — nothing
// above the repository interface changes. Column names in `../drizzle/schema`
// already match the entity field names 1:1, so query results need no mapping.

export function createDrizzleRepositories(): Repositories {
  const db = getDb();

  return {
    studios: {
      getFirst: async () => {
        const rows = await db.select().from(studios).limit(1);
        return rows[0] ?? null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const rows = await db
          .select()
          .from(studioSettings)
          .where(eq(studioSettings.studioId, studioId))
          .limit(1);
        return rows[0] ?? null;
      },
      update: async (studioId, patch) => {
        const rows = await db
          .update(studioSettings)
          .set(patch)
          .where(eq(studioSettings.studioId, studioId))
          .returning();
        return rows[0] as StudioSettings;
      },
    },
    members: {
      listByStudio: (studioId) =>
        db.select().from(members).where(eq(members.studioId, studioId)).orderBy(members.name),
      getById: async (id) => {
        const rows = await db.select().from(members).where(eq(members.id, id)).limit(1);
        return rows[0] ?? null;
      },
      findByEmail: async (studioId, email) => {
        const rows = await db
          .select()
          .from(members)
          .where(and(eq(members.studioId, studioId), eq(members.email, email)))
          .limit(1);
        return rows[0] ?? null;
      },
      insert: async (member) => {
        const rows = await db.insert(members).values(member).returning();
        return rows[0] as Member;
      },
      update: async (id, patch) => {
        const rows = await db.update(members).set(patch).where(eq(members.id, id)).returning();
        return rows[0] as Member;
      },
    },
    classTypes: {
      listByStudio: (studioId) =>
        db
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(classTypes.name),
      getById: async (id) => {
        const rows = await db.select().from(classTypes).where(eq(classTypes.id, id)).limit(1);
        return rows[0] ?? null;
      },
      insert: async (classType) => {
        const rows = await db.insert(classTypes).values(classType).returning();
        return rows[0] as ClassType;
      },
    },
    classSessions: {
      listByStudio: (studioId, range = {}) => {
        const conditions = [eq(classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(classSessions.startsAt, range.to));
        return db
          .select()
          .from(classSessions)
          .where(and(...conditions))
          .orderBy(classSessions.startsAt);
      },
      getById: async (id) => {
        const rows = await db.select().from(classSessions).where(eq(classSessions.id, id)).limit(1);
        return rows[0] ?? null;
      },
      insert: async (session) => {
        const rows = await db.insert(classSessions).values(session).returning();
        return rows[0] as ClassSession;
      },
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return db.select().from(bookings).where(inArray(bookings.sessionId, sessionIds));
      },
      listBySession: (sessionId) =>
        db.select().from(bookings).where(eq(bookings.sessionId, sessionId)),
      getById: async (id) => {
        const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
        return rows[0] ?? null;
      },
      insert: async (booking) => {
        const rows = await db.insert(bookings).values(booking).returning();
        return rows[0] as Booking;
      },
      update: async (id, patch) => {
        const rows = await db.update(bookings).set(patch).where(eq(bookings.id, id)).returning();
        return rows[0] as Booking;
      },
    },
    invoices: {
      listByStudio: (studioId) =>
        db
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt)),
      getById: async (id) => {
        const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
        return rows[0] ?? null;
      },
      countByStudio: async (studioId) => {
        const rows = await db
          .select({ count: count() })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return rows[0]?.count ?? 0;
      },
      insert: async (invoice) => {
        const rows = await db.insert(invoices).values(invoice).returning();
        return rows[0] as Invoice;
      },
      update: async (id, patch) => {
        const rows = await db.update(invoices).set(patch).where(eq(invoices.id, id)).returning();
        return rows[0] as Invoice;
      },
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId)),
      insertMany: async (items) => {
        if (items.length === 0) return [];
        return db.insert(invoiceLineItems).values(items).returning() as Promise<InvoiceLineItem[]>;
      },
    },
    outbox: {
      insert: async (row) => {
        const rows = await db.insert(notificationOutbox).values(row).returning();
        return rows[0] as NotificationOutboxRow;
      },
      listPending: () =>
        db.select().from(notificationOutbox).where(isNull(notificationOutbox.sentAt)),
      update: async (id, patch) => {
        const rows = await db
          .update(notificationOutbox)
          .set(patch)
          .where(eq(notificationOutbox.id, id))
          .returning();
        return rows[0] as NotificationOutboxRow;
      },
    },
  };
}
