import { and, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "../schema";
import type { Repositories } from "./types";

// Production repository implementation over Cloudflare D1 (SQLite) with Drizzle ORM.
// All methods match the interface contract and ordering from the Supabase impl.
// Services build full rows (ids + timestamps app-side) so the DB is schema-only.

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  return {
    studios: {
      getFirst: async () => {
        const result = await drizzleDb.select().from(schema.studios).limit(1);
        return result.length > 0 ? result[0] : null;
      },
    },
    settings: {
      getByStudioId: async (studioId) => {
        const result = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId))
          .limit(1);
        return result.length > 0 ? result[0] : null;
      },
      update: async (studioId, patch) => {
        const updated = await drizzleDb
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return updated[0];
      },
    },
    members: {
      listByStudio: async (studioId) => {
        return drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name);
      },
      getById: async (id) => {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))
          .limit(1);
        return result.length > 0 ? result[0] : null;
      },
      findByEmail: async (studioId, email) => {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
          .limit(1);
        return result.length > 0 ? result[0] : null;
      },
      insert: async (member) => {
        const inserted = await drizzleDb.insert(schema.members).values(member).returning();
        return inserted[0];
      },
      update: async (id, patch) => {
        const updated = await drizzleDb
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        return updated[0];
      },
    },
    classTypes: {
      listByStudio: async (studioId) => {
        return drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name);
      },
      getById: async (id) => {
        const result = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id))
          .limit(1);
        return result.length > 0 ? result[0] : null;
      },
      insert: async (classType) => {
        const inserted = await drizzleDb.insert(schema.classTypes).values(classType).returning();
        return inserted[0];
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
        return drizzleDb
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.startsAt);
      },
      getById: async (id) => {
        const result = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id))
          .limit(1);
        return result.length > 0 ? result[0] : null;
      },
      insert: async (session) => {
        const inserted = await drizzleDb.insert(schema.classSessions).values(session).returning();
        return inserted[0];
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
          .where(eq(schema.bookings.id, id))
          .limit(1);
        return result.length > 0 ? result[0] : null;
      },
      insert: async (booking) => {
        const inserted = await drizzleDb.insert(schema.bookings).values(booking).returning();
        return inserted[0];
      },
      update: async (id, patch) => {
        const updated = await drizzleDb
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        return updated[0];
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
          .where(eq(schema.invoices.id, id))
          .limit(1);
        return result.length > 0 ? result[0] : null;
      },
      countByStudio: async (studioId) => {
        const result = await drizzleDb
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .limit(1);
        return result.length > 0 ? result[0].value : 0;
      },
      insert: async (invoice) => {
        const inserted = await drizzleDb.insert(schema.invoices).values(invoice).returning();
        return inserted[0];
      },
      update: async (id, patch) => {
        const updated = await drizzleDb
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        return updated[0];
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
        const inserted = await drizzleDb.insert(schema.invoiceLineItems).values(items).returning();
        return inserted;
      },
    },
    outbox: {
      insert: async (row) => {
        const inserted = await drizzleDb.insert(schema.notificationOutbox).values(row).returning();
        return inserted[0];
      },
      listPending: async () => {
        return drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      update: async (id, patch) => {
        const updated = await drizzleDb
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return updated[0];
      },
    },
  };
}
