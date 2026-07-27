import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  bookings,
  classTypes,
  classSessions,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  studios,
  studioSettings,
} from "../schema";
import type { Repositories } from "./types";

// D1Database type definition (from @cloudflare/workers-types)
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: string[]): Promise<T[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1Result;
  first<T = Record<string, unknown>>(): Promise<T | undefined>;
  all<T = Record<string, unknown>>(): Promise<T[]>;
  run(): Promise<D1Result>;
}

interface D1Result {
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1ExecResult {
  success: boolean;
}

// Production D1 repository implementation using Drizzle ORM. Takes a D1Database
// binding and implements the full Repositories interface with the same
// semantics as the Supabase adapter. Column mapping (snake_case ↔ camelCase)
// is handled by the Drizzle schema definition.

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db);

  return {
    studios: {
      getFirst: async () => {
        const result = await drizzleDb.select().from(studios).limit(1);
        return result[0] ?? null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const result = await drizzleDb
          .select()
          .from(studioSettings)
          .where(eq(studioSettings.studioId, studioId));
        return result[0] ?? null;
      },
      update: async (studioId, patch) => {
        const result = await drizzleDb
          .update(studioSettings)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(patch as any)
          .where(eq(studioSettings.studioId, studioId))
          .returning();
        return result[0]!;
      },
    },
    members: {
      listByStudio: async (studioId) => {
        return drizzleDb
          .select()
          .from(members)
          .where(eq(members.studioId, studioId))
          .orderBy(asc(members.name));
      },
      getById: async (id) => {
        const result = await drizzleDb.select().from(members).where(eq(members.id, id));
        return result[0] ?? null;
      },
      findByEmail: async (studioId, email) => {
        const result = await drizzleDb
          .select()
          .from(members)
          .where(and(eq(members.studioId, studioId), eq(members.email, email)));
        return result[0] ?? null;
      },
      insert: async (member) => {
        const result = await drizzleDb
          .insert(members)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values(member as any)
          .returning();
        return result[0]!;
      },
      update: async (id, patch) => {
        const result = await drizzleDb
          .update(members)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(patch as any)
          .where(eq(members.id, id))
          .returning();
        return result[0]!;
      },
    },
    classTypes: {
      listByStudio: async (studioId) => {
        return drizzleDb
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name));
      },
      getById: async (id) => {
        const result = await drizzleDb.select().from(classTypes).where(eq(classTypes.id, id));
        return result[0] ?? null;
      },
      insert: async (classType) => {
        const result = await drizzleDb
          .insert(classTypes)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values(classType as any)
          .returning();
        return result[0]!;
      },
    },
    classSessions: {
      listByStudio: async (studioId, range = {}) => {
        const conditions = [eq(classSessions.studioId, studioId)];

        if (range.from) {
          conditions.push(gte(classSessions.startsAt, range.from));
        }
        if (range.to) {
          conditions.push(lt(classSessions.startsAt, range.to));
        }

        return drizzleDb
          .select()
          .from(classSessions)
          .where(and(...conditions))
          .orderBy(asc(classSessions.startsAt));
      },
      getById: async (id) => {
        const result = await drizzleDb.select().from(classSessions).where(eq(classSessions.id, id));
        return result[0] ?? null;
      },
      insert: async (session) => {
        const result = await drizzleDb
          .insert(classSessions)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values(session as any)
          .returning();
        return result[0]!;
      },
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return drizzleDb.select().from(bookings).where(inArray(bookings.sessionId, sessionIds));
      },
      listBySession: async (sessionId) => {
        return drizzleDb.select().from(bookings).where(eq(bookings.sessionId, sessionId));
      },
      getById: async (id) => {
        const result = await drizzleDb.select().from(bookings).where(eq(bookings.id, id));
        return result[0] ?? null;
      },
      insert: async (booking) => {
        const result = await drizzleDb
          .insert(bookings)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values(booking as any)
          .returning();
        return result[0]!;
      },
      update: async (id, patch) => {
        const result = await drizzleDb
          .update(bookings)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(patch as any)
          .where(eq(bookings.id, id))
          .returning();
        return result[0]!;
      },
    },
    invoices: {
      listByStudio: async (studioId) => {
        return drizzleDb
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt));
      },
      getById: async (id) => {
        const result = await drizzleDb.select().from(invoices).where(eq(invoices.id, id));
        return result[0] ?? null;
      },
      countByStudio: async (studioId) => {
        const result = await drizzleDb
          .select({ count: count() })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return result[0]?.count ?? 0;
      },
      insert: async (invoice) => {
        const result = await drizzleDb
          .insert(invoices)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values(invoice as any)
          .returning();
        return result[0]!;
      },
      update: async (id, patch) => {
        const result = await drizzleDb
          .update(invoices)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(patch as any)
          .where(eq(invoices.id, id))
          .returning();
        return result[0]!;
      },
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) => {
        return drizzleDb
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoiceId));
      },
      insertMany: async (items) => {
        if (items.length === 0) return [];
        const result = await drizzleDb
          .insert(invoiceLineItems)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values(items as any[])
          .returning();
        return result;
      },
    },
    outbox: {
      insert: async (row) => {
        const result = await drizzleDb
          .insert(notificationOutbox)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values(row as unknown as any)
          .returning();
        return result[0]!;
      },
      listPending: async () => {
        return drizzleDb.select().from(notificationOutbox).where(isNull(notificationOutbox.sentAt));
      },
      update: async (id, patch) => {
        const result = await drizzleDb
          .update(notificationOutbox)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(patch as unknown as any)
          .where(eq(notificationOutbox.id, id))
          .returning();
        return result[0]!;
      },
    },
  };
}
