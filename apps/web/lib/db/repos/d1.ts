import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema";
import type { Repositories } from "./types";

// D1 repository implementation using Drizzle ORM. Takes a D1Database binding,
// wraps it with Drizzle, and implements the full Repositories interface with the
// same semantics as the old Supabase impl — order, filtering, counting, and
// returning updated rows.

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  return {
    studios: {
      getFirst: async () => {
        const result = await drizzleDb.select().from(schema.studios).limit(1);
        return result[0] ?? null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const result = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return result[0] ?? null;
      },
      update: async (studioId, patch) => {
        await drizzleDb
          .update(schema.studioSettings)
          .set(patch as typeof schema.studioSettings.$inferInsert)
          .where(eq(schema.studioSettings.studioId, studioId));
        const result = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return result[0]!;
      },
    },
    members: {
      listByStudio: async (studioId) => {
        return drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
      },
      getById: async (id) => {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id));
        return result[0] ?? null;
      },
      findByEmail: async (studioId, email) => {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return result[0] ?? null;
      },
      insert: async (member) => {
        await drizzleDb.insert(schema.members).values(member);
        return member;
      },
      update: async (id, patch) => {
        await drizzleDb
          .update(schema.members)
          .set(patch as typeof schema.members.$inferInsert)
          .where(eq(schema.members.id, id));
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id));
        return result[0]!;
      },
    },
    classTypes: {
      listByStudio: async (studioId) => {
        return drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
      },
      getById: async (id) => {
        const result = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return result[0] ?? null;
      },
      insert: async (classType) => {
        await drizzleDb.insert(schema.classTypes).values(classType);
        return classType;
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
        const result = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return result[0] ?? null;
      },
      insert: async (session) => {
        await drizzleDb.insert(schema.classSessions).values(session);
        return session;
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
      listBySession: async (sessionId) => {
        return drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
      },
      getById: async (id) => {
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id));
        return result[0] ?? null;
      },
      insert: async (booking) => {
        await drizzleDb.insert(schema.bookings).values(booking);
        return booking;
      },
      update: async (id, patch) => {
        await drizzleDb
          .update(schema.bookings)
          .set(patch as typeof schema.bookings.$inferInsert)
          .where(eq(schema.bookings.id, id));
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id));
        return result[0]!;
      },
    },
    invoices: {
      listByStudio: async (studioId) => {
        return drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      getById: async (id) => {
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id));
        return result[0] ?? null;
      },
      countByStudio: async (studioId) => {
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return result.length;
      },
      insert: async (invoice) => {
        await drizzleDb.insert(schema.invoices).values(invoice);
        return invoice;
      },
      update: async (id, patch) => {
        await drizzleDb
          .update(schema.invoices)
          .set(patch as typeof schema.invoices.$inferInsert)
          .where(eq(schema.invoices.id, id));
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id));
        return result[0]!;
      },
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) => {
        return drizzleDb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      insertMany: async (items) => {
        if (items.length === 0) return [];
        await drizzleDb.insert(schema.invoiceLineItems).values(items);
        return items;
      },
    },
    outbox: {
      insert: async (row) => {
        await drizzleDb.insert(schema.notificationOutbox).values(row);
        return row;
      },
      listPending: async () => {
        return drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      update: async (id, patch) => {
        await drizzleDb
          .update(schema.notificationOutbox)
          .set(patch as typeof schema.notificationOutbox.$inferInsert)
          .where(eq(schema.notificationOutbox.id, id));
        const result = await drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(eq(schema.notificationOutbox.id, id));
        return result[0]!;
      },
    },
  };
}
