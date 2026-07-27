import { and, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
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
import {
  bookingsTable,
  classSessionsTable,
  classTypesTable,
  invoiceLineItemsTable,
  invoicesTable,
  membersTable,
  notificationOutboxTable,
  studioSettingsTable,
  studiosTable,
  schema,
} from "./schema";
import type { Repositories } from "./types";

// Production repository implementation over Cloudflare D1 (SQLite). Drizzle
// column names map directly to camelCase domain fields, so no separate mapping
// pass is needed. Behaviour is identical to the Supabase implementation it replaces.

export function createD1Repositories(db: D1Database): Repositories {
  const orm = drizzle(db, { schema });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function insertReturning<T>(table: any, row: T): Promise<T> {
    const result = await orm
      .insert(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values(row as any)
      .returning();
    return ((result as T[])?.[0] ?? row) as T;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function updateReturning<T>(table: any, match: any, patch: Partial<T>): Promise<T> {
    const result = await orm
      .update(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(patch as any)
      .where(match)
      .returning();
    return (result as T[])[0] as T;
  }

  return {
    studios: {
      getFirst: async () => {
        const result = await orm.select().from(studiosTable).limit(1);
        return (result[0] ?? null) as Studio | null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const result = await orm
          .select()
          .from(studioSettingsTable)
          .where(eq(studioSettingsTable.studioId, studioId));
        return (result[0] ?? null) as StudioSettings | null;
      },
      update: async (studioId, patch) =>
        updateReturning(studioSettingsTable, eq(studioSettingsTable.studioId, studioId), patch),
    },
    members: {
      listByStudio: async (studioId) => {
        const result = await orm
          .select()
          .from(membersTable)
          .where(eq(membersTable.studioId, studioId))
          .orderBy(membersTable.name);
        return result as Member[];
      },
      getById: async (id) => {
        const result = await orm.select().from(membersTable).where(eq(membersTable.id, id));
        return (result[0] ?? null) as Member | null;
      },
      findByEmail: async (studioId, email) => {
        const result = await orm
          .select()
          .from(membersTable)
          .where(and(eq(membersTable.studioId, studioId), eq(membersTable.email, email)));
        return (result[0] ?? null) as Member | null;
      },
      insert: async (member) => insertReturning(membersTable, member),
      update: async (id, patch) => updateReturning(membersTable, eq(membersTable.id, id), patch),
    },
    classTypes: {
      listByStudio: async (studioId) => {
        const result = await orm
          .select()
          .from(classTypesTable)
          .where(eq(classTypesTable.studioId, studioId))
          .orderBy(classTypesTable.name);
        return result as ClassType[];
      },
      getById: async (id) => {
        const result = await orm.select().from(classTypesTable).where(eq(classTypesTable.id, id));
        return (result[0] ?? null) as ClassType | null;
      },
      insert: async (classType) => insertReturning(classTypesTable, classType),
    },
    classSessions: {
      listByStudio: async (studioId, range = {}) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conditions: any[] = [eq(classSessionsTable.studioId, studioId)];
        if (range.from) conditions.push(gte(classSessionsTable.startsAt, range.from));
        if (range.to) conditions.push(lt(classSessionsTable.startsAt, range.to));
        const result = await orm
          .select()
          .from(classSessionsTable)
          .where(and(...conditions))
          .orderBy(classSessionsTable.startsAt);
        return result as ClassSession[];
      },
      getById: async (id) => {
        const result = await orm
          .select()
          .from(classSessionsTable)
          .where(eq(classSessionsTable.id, id));
        return (result[0] ?? null) as ClassSession | null;
      },
      insert: async (session) => insertReturning(classSessionsTable, session),
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        const result = await orm
          .select()
          .from(bookingsTable)
          .where(inArray(bookingsTable.sessionId, sessionIds));
        return result as Booking[];
      },
      listBySession: async (sessionId) => {
        const result = await orm
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.sessionId, sessionId));
        return result as Booking[];
      },
      getById: async (id) => {
        const result = await orm.select().from(bookingsTable).where(eq(bookingsTable.id, id));
        return (result[0] ?? null) as Booking | null;
      },
      insert: async (booking) => insertReturning(bookingsTable, booking),
      update: async (id, patch) => updateReturning(bookingsTable, eq(bookingsTable.id, id), patch),
    },
    invoices: {
      listByStudio: async (studioId) => {
        const result = await orm
          .select()
          .from(invoicesTable)
          .where(eq(invoicesTable.studioId, studioId))
          .orderBy(desc(invoicesTable.issuedAt));
        return result as Invoice[];
      },
      getById: async (id) => {
        const result = await orm.select().from(invoicesTable).where(eq(invoicesTable.id, id));
        return (result[0] ?? null) as Invoice | null;
      },
      countByStudio: async (studioId) => {
        const result = await orm
          .select({ count: count() })
          .from(invoicesTable)
          .where(eq(invoicesTable.studioId, studioId));
        return result[0]?.count ?? 0;
      },
      insert: async (invoice) => insertReturning(invoicesTable, invoice),
      update: async (id, patch) => updateReturning(invoicesTable, eq(invoicesTable.id, id), patch),
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) => {
        const result = await orm
          .select()
          .from(invoiceLineItemsTable)
          .where(eq(invoiceLineItemsTable.invoiceId, invoiceId));
        return result as InvoiceLineItem[];
      },
      insertMany: async (items) => {
        if (items.length === 0) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await orm.insert(invoiceLineItemsTable).values(items as any);
        return items;
      },
    },
    outbox: {
      insert: async (row) => insertReturning(notificationOutboxTable, row),
      listPending: async () => {
        const result = await orm
          .select()
          .from(notificationOutboxTable)
          .where(isNull(notificationOutboxTable.sentAt));
        return result as NotificationOutboxRow[];
      },
      update: async (id, patch) =>
        updateReturning(notificationOutboxTable, eq(notificationOutboxTable.id, id), patch),
    },
  };
}
