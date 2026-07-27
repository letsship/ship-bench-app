import type { D1Database } from "@cloudflare/workers-types";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
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
  bookings,
  classSessions,
  classTypes,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  studioSettings,
  studios,
} from "./schema";
import type { Repositories } from "./types";

// The production repository implementation over Drizzle + Cloudflare D1. This
// is the ONE file a Supabase→D1 migration adds — nothing above the repository
// interface changes. Rows round-trip as plain camelCase objects: Drizzle maps
// each column to its declared camelCase key in schema.ts, so no separate
// snake<->camel translation step is needed here (unlike the Supabase impl).

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db);

  async function insertReturning<T>(
    table: Parameters<typeof drizzleDb.insert>[0],
    row: T,
  ): Promise<T> {
    const [inserted] = await drizzleDb
      .insert(table)
      .values(row as never)
      .returning();
    return inserted as T;
  }

  async function updateReturning<T>(
    table: Parameters<typeof drizzleDb.update>[0],
    idColumn: never,
    id: string,
    patch: Partial<T>,
  ): Promise<T> {
    const [updated] = await drizzleDb
      .update(table)
      .set(patch as never)
      .where(eq(idColumn, id))
      .returning();
    return updated as T;
  }

  return {
    studios: {
      getFirst: async () => {
        const [row] = await drizzleDb.select().from(studios).limit(1);
        return (row as Studio) ?? null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const [row] = await drizzleDb
          .select()
          .from(studioSettings)
          .where(eq(studioSettings.studioId, studioId));
        return (row as StudioSettings) ?? null;
      },
      update: (studioId, patch) =>
        updateReturning<StudioSettings>(
          studioSettings,
          studioSettings.studioId as never,
          studioId,
          patch,
        ),
    },
    members: {
      listByStudio: async (studioId) => {
        const rows = await drizzleDb
          .select()
          .from(members)
          .where(eq(members.studioId, studioId))
          .orderBy(asc(members.name));
        return rows as Member[];
      },
      getById: async (id) => {
        const [row] = await drizzleDb.select().from(members).where(eq(members.id, id));
        return (row as Member) ?? null;
      },
      findByEmail: async (studioId, email) => {
        const [row] = await drizzleDb
          .select()
          .from(members)
          .where(and(eq(members.studioId, studioId), eq(members.email, email)));
        return (row as Member) ?? null;
      },
      insert: (member) => insertReturning(members, member),
      update: (id, patch) => updateReturning<Member>(members, members.id as never, id, patch),
    },
    classTypes: {
      listByStudio: async (studioId) => {
        const rows = await drizzleDb
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name));
        return rows as ClassType[];
      },
      getById: async (id) => {
        const [row] = await drizzleDb.select().from(classTypes).where(eq(classTypes.id, id));
        return (row as ClassType) ?? null;
      },
      insert: (classType) => insertReturning(classTypes, classType),
    },
    classSessions: {
      listByStudio: async (studioId, range = {}) => {
        const conditions = [eq(classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(classSessions.startsAt, range.to));
        const rows = await drizzleDb
          .select()
          .from(classSessions)
          .where(and(...conditions))
          .orderBy(asc(classSessions.startsAt));
        return rows as ClassSession[];
      },
      getById: async (id) => {
        const [row] = await drizzleDb.select().from(classSessions).where(eq(classSessions.id, id));
        return (row as ClassSession) ?? null;
      },
      insert: (session) => insertReturning(classSessions, session),
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        const rows = await drizzleDb
          .select()
          .from(bookings)
          .where(inArray(bookings.sessionId, sessionIds));
        return rows as Booking[];
      },
      listBySession: async (sessionId) => {
        const rows = await drizzleDb
          .select()
          .from(bookings)
          .where(eq(bookings.sessionId, sessionId));
        return rows as Booking[];
      },
      getById: async (id) => {
        const [row] = await drizzleDb.select().from(bookings).where(eq(bookings.id, id));
        return (row as Booking) ?? null;
      },
      insert: (booking) => insertReturning(bookings, booking),
      update: (id, patch) => updateReturning<Booking>(bookings, bookings.id as never, id, patch),
    },
    invoices: {
      listByStudio: async (studioId) => {
        const rows = await drizzleDb
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt));
        return rows as Invoice[];
      },
      getById: async (id) => {
        const [row] = await drizzleDb.select().from(invoices).where(eq(invoices.id, id));
        return (row as Invoice) ?? null;
      },
      countByStudio: async (studioId) => {
        const [row] = await drizzleDb
          .select({ count: sql<number>`count(*)` })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return row?.count ?? 0;
      },
      insert: (invoice) => insertReturning(invoices, invoice),
      update: (id, patch) => updateReturning<Invoice>(invoices, invoices.id as never, id, patch),
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) => {
        const rows = await drizzleDb
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoiceId));
        return rows as InvoiceLineItem[];
      },
      insertMany: async (items) => {
        if (items.length === 0) return [];
        const rows = await drizzleDb
          .insert(invoiceLineItems)
          .values(items as never)
          .returning();
        return rows as InvoiceLineItem[];
      },
    },
    outbox: {
      insert: (row) => insertReturning(notificationOutbox, row),
      listPending: async () => {
        const rows = await drizzleDb
          .select()
          .from(notificationOutbox)
          .where(isNull(notificationOutbox.sentAt));
        return rows as NotificationOutboxRow[];
      },
      update: (id, patch) =>
        updateReturning<NotificationOutboxRow>(
          notificationOutbox,
          notificationOutbox.id as never,
          id,
          patch,
        ),
    },
  };
}
