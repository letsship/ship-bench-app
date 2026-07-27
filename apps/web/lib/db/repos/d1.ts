import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { Repositories } from "./types";

// The production repository implementation over Drizzle ORM + Cloudflare D1.
// Rows are stored/queried in snake_case via the Drizzle schema (schema.ts);
// Drizzle's JS-side property names already match the camelCase domain
// entities in lib/db/types.ts, so no separate row-mapping step is needed. This
// is the ONE file a D1 -> other-database migration rewrites — nothing above
// the repository interface changes.

export function createD1Repositories(db: D1Database): Repositories {
  const client = drizzle(db, { schema });

  return {
    studios: {
      async getFirst() {
        const [row] = await client.select().from(schema.studios).limit(1);
        return row ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const [row] = await client
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return row ?? null;
      },
      async update(studioId, patch) {
        const [row] = await client
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        if (!row) throw new Error("Studio settings not found");
        return row;
      },
    },
    members: {
      async listByStudio(studioId) {
        return client
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
      },
      async getById(id) {
        const [row] = await client.select().from(schema.members).where(eq(schema.members.id, id));
        return row ?? null;
      },
      async findByEmail(studioId, email) {
        const [row] = await client
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return row ?? null;
      },
      async insert(member) {
        const [row] = await client.insert(schema.members).values(member).returning();
        return row;
      },
      async update(id, patch) {
        const [row] = await client
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        if (!row) throw new Error("Member not found");
        return row;
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return client
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
      },
      async getById(id) {
        const [row] = await client
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return row ?? null;
      },
      async insert(classType) {
        const [row] = await client.insert(schema.classTypes).values(classType).returning();
        return row;
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return client
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
      },
      async getById(id) {
        const [row] = await client
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return row ?? null;
      },
      async insert(session) {
        const [row] = await client.insert(schema.classSessions).values(session).returning();
        return row;
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return client
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId) {
        return client
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id) {
        const [row] = await client.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return row ?? null;
      },
      async insert(booking) {
        const [row] = await client.insert(schema.bookings).values(booking).returning();
        return row;
      },
      async update(id, patch) {
        const [row] = await client
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        if (!row) throw new Error("Booking not found");
        return row;
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return client
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      async getById(id) {
        const [row] = await client.select().from(schema.invoices).where(eq(schema.invoices.id, id));
        return row ?? null;
      },
      async countByStudio(studioId) {
        const [row] = await client
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return row?.value ?? 0;
      },
      async insert(invoice) {
        const [row] = await client.insert(schema.invoices).values(invoice).returning();
        return row;
      },
      async update(id, patch) {
        const [row] = await client
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        if (!row) throw new Error("Invoice not found");
        return row;
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return client
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        return client.insert(schema.invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      async insert(row) {
        const [inserted] = await client.insert(schema.notificationOutbox).values(row).returning();
        return inserted;
      },
      async listPending() {
        return client
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch) {
        const [row] = await client
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        if (!row) throw new Error("Outbox row not found");
        return row;
      },
    },
  };
}
