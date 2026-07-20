import { and, count, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
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

// Production repository implementation over Cloudflare D1 + Drizzle ORM.
// Uses Drizzle's column() to map snake_case DB columns to camelCase entity fields.
// This is the ONE file the Supabase→D1 migration replaces — nothing above the
// repository interface changes.

export interface D1Database {
  prepare(sql: string): D1Statement;
}

export interface D1Statement {
  bind(...params: unknown[]): this;
  first(options?: unknown): Promise<Record<string, unknown> | undefined>;
  all(options?: unknown): Promise<Record<string, unknown>[]>;
  run(options?: unknown): Promise<unknown>;
  raw(options?: unknown): Promise<unknown[]>;
}

export function createD1Repositories(db: D1Database): Repositories {
  const orm = drizzle(db, { schema });

  return {
    studios: {
      getFirst: async () => {
        const result = await orm.select().from(schema.studios).limit(1);
        return (result[0] as Studio | undefined) ?? null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const result = await orm
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return (result[0] as StudioSettings | undefined) ?? null;
      },
      update: async (studioId, patch) => {
        await orm
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId));
        const result = await orm
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return result[0] as StudioSettings;
      },
    },
    members: {
      listByStudio: async (studioId) => {
        const result = await orm
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name);
        return result as Member[];
      },
      getById: async (id) => {
        const result = await orm.select().from(schema.members).where(eq(schema.members.id, id));
        return (result[0] as Member | undefined) ?? null;
      },
      findByEmail: async (studioId, email) => {
        const result = await orm
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return (result[0] as Member | undefined) ?? null;
      },
      insert: async (member) => {
        await orm.insert(schema.members).values(member);
        return member;
      },
      update: async (id, patch) => {
        await orm.update(schema.members).set(patch).where(eq(schema.members.id, id));
        const result = await orm.select().from(schema.members).where(eq(schema.members.id, id));
        return result[0] as Member;
      },
    },
    classTypes: {
      listByStudio: async (studioId) => {
        const result = await orm
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name);
        return result as ClassType[];
      },
      getById: async (id) => {
        const result = await orm
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return (result[0] as ClassType | undefined) ?? null;
      },
      insert: async (classType) => {
        await orm.insert(schema.classTypes).values(classType);
        return classType;
      },
    },
    classSessions: {
      listByStudio: async (studioId, range = {}) => {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));

        const result = await orm
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.startsAt);
        return result as ClassSession[];
      },
      getById: async (id) => {
        const result = await orm
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return (result[0] as ClassSession | undefined) ?? null;
      },
      insert: async (session) => {
        await orm.insert(schema.classSessions).values(session);
        return session;
      },
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        const result = await orm
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
        return result as Booking[];
      },
      listBySession: async (sessionId) => {
        const result = await orm
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
        return result as Booking[];
      },
      getById: async (id) => {
        const result = await orm.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return (result[0] as Booking | undefined) ?? null;
      },
      insert: async (booking) => {
        await orm.insert(schema.bookings).values(booking);
        return booking;
      },
      update: async (id, patch) => {
        await orm.update(schema.bookings).set(patch).where(eq(schema.bookings.id, id));
        const result = await orm.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return result[0] as Booking;
      },
    },
    invoices: {
      listByStudio: async (studioId) => {
        const result = await orm
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(sql`${schema.invoices.issuedAt} DESC`);
        return result as Invoice[];
      },
      getById: async (id) => {
        const result = await orm.select().from(schema.invoices).where(eq(schema.invoices.id, id));
        return (result[0] as Invoice | undefined) ?? null;
      },
      countByStudio: async (studioId) => {
        const result = await orm
          .select({ count: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return result[0]?.count ?? 0;
      },
      insert: async (invoice) => {
        await orm.insert(schema.invoices).values(invoice);
        return invoice;
      },
      update: async (id, patch) => {
        await orm.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id));
        const result = await orm.select().from(schema.invoices).where(eq(schema.invoices.id, id));
        return result[0] as Invoice;
      },
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) => {
        const result = await orm
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
        return result as InvoiceLineItem[];
      },
      insertMany: async (items) => {
        if (items.length === 0) return [];
        await orm.insert(schema.invoiceLineItems).values(items);
        return items;
      },
    },
    outbox: {
      insert: async (row) => {
        await orm.insert(schema.notificationOutbox).values(row);
        return row;
      },
      listPending: async () => {
        const result = await orm
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
        return result as NotificationOutboxRow[];
      },
      update: async (id, patch) => {
        await orm
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id));
        const result = await orm
          .select()
          .from(schema.notificationOutbox)
          .where(eq(schema.notificationOutbox.id, id));
        return result[0] as NotificationOutboxRow;
      },
    },
  };
}
