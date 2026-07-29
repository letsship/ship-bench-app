import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, lt, desc, count, inArray, isNull } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import type { Repositories } from "./types";
import * as schema from "./schema";

export function createD1Repositories(db: D1Database): Repositories {
  const d = drizzle(db, { schema });

  return {
    studios: {
      async getFirst() {
        const rows = await d.select().from(schema.studios).limit(1);
        return rows[0] ?? null;
      },
    },

    settings: {
      async getByStudioId(studioId) {
        const rows = await d
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId))
          .limit(1);
        return rows[0] ?? null;
      },
      async update(studioId, patch) {
        const rows = await d
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return rows[0];
      },
    },

    members: {
      async listByStudio(studioId) {
        return d
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name);
      },
      async getById(id) {
        const rows = await d
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async findByEmail(studioId, email) {
        const rows = await d
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(member) {
        const rows = await d.insert(schema.members).values(member).returning();
        return rows[0];
      },
      async update(id, patch) {
        const rows = await d
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        return rows[0];
      },
    },

    classTypes: {
      async listByStudio(studioId) {
        return d
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name);
      },
      async getById(id) {
        const rows = await d
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(classType) {
        const rows = await d.insert(schema.classTypes).values(classType).returning();
        return rows[0];
      },
    },

    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return d
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.startsAt);
      },
      async getById(id) {
        const rows = await d
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(session) {
        const rows = await d.insert(schema.classSessions).values(session).returning();
        return rows[0];
      },
    },

    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return d
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId) {
        return d
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id) {
        const rows = await d
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(booking) {
        const rows = await d.insert(schema.bookings).values(booking).returning();
        return rows[0];
      },
      async update(id, patch) {
        const rows = await d
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        return rows[0];
      },
    },

    invoices: {
      async listByStudio(studioId) {
        return d
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      async getById(id) {
        const rows = await d
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async countByStudio(studioId) {
        const rows = await d
          .select({ count: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows[0]?.count ?? 0;
      },
      async insert(invoice) {
        const rows = await d.insert(schema.invoices).values(invoice).returning();
        return rows[0];
      },
      async update(id, patch) {
        const rows = await d
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        return rows[0];
      },
    },

    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return d
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        const rows = await d.insert(schema.invoiceLineItems).values(items).returning();
        return rows;
      },
    },

    outbox: {
      async insert(row) {
        const rows = await d.insert(schema.notificationOutbox).values(row).returning();
        return rows[0];
      },
      async listPending() {
        return d
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch) {
        const rows = await d
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return rows[0];
      },
    },
  };
}