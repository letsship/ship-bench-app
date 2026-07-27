import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../schema";
import type { Repositories } from "./types";

// The production repository implementation over the Cloudflare D1 binding via
// Drizzle ORM. D1's column shapes already match the camelCase entity types 1:1
// (see ../schema), so rows read/write straight through — no snake/camel
// mapping layer needed on this path. This is the ONE file a Supabase -> D1
// migration adds — nothing above the repository interface changes.

// D1 caps bound parameters at 100 per statement. Invoice line items bind 8
// columns each, so chunk batched inserts well under that ceiling.
const INSERT_MANY_CHUNK_SIZE = 10;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function createD1Repositories(db: D1Database): Repositories {
  const drz = drizzle(db, { schema });

  return {
    studios: {
      async getFirst() {
        const [row] = await drz.select().from(schema.studios).limit(1);
        return row ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const [row] = await drz
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return row ?? null;
      },
      async update(studioId, patch) {
        const [updated] = await drz
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        if (!updated) throw new Error("Studio settings not found");
        return updated;
      },
    },
    members: {
      async listByStudio(studioId) {
        // SQLite's ORDER BY uses byte-order (BINARY) collation, which diverges
        // from the fakes' String.localeCompare on non-ASCII names. Sort in JS
        // after fetching so both adapters produce the same order.
        const rows = await drz
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId));
        return rows.sort((a, b) => a.name.localeCompare(b.name));
      },
      async getById(id) {
        const [row] = await drz.select().from(schema.members).where(eq(schema.members.id, id));
        return row ?? null;
      },
      async findByEmail(studioId, email) {
        const [row] = await drz
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return row ?? null;
      },
      async insert(member) {
        const [inserted] = await drz.insert(schema.members).values(member).returning();
        return inserted;
      },
      async update(id, patch) {
        const [updated] = await drz
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        if (!updated) throw new Error("Member not found");
        return updated;
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        // Sort in JS to match the fakes' String.localeCompare ordering — see
        // the members.listByStudio comment above for why.
        const rows = await drz
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId));
        return rows.sort((a, b) => a.name.localeCompare(b.name));
      },
      async getById(id) {
        const [row] = await drz
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return row ?? null;
      },
      async insert(classType) {
        const [inserted] = await drz.insert(schema.classTypes).values(classType).returning();
        return inserted;
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return drz
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
      },
      async getById(id) {
        const [row] = await drz
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return row ?? null;
      },
      async insert(session) {
        const [inserted] = await drz.insert(schema.classSessions).values(session).returning();
        return inserted;
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return drz
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId) {
        return drz.select().from(schema.bookings).where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id) {
        const [row] = await drz.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return row ?? null;
      },
      async insert(booking) {
        const [inserted] = await drz.insert(schema.bookings).values(booking).returning();
        return inserted;
      },
      async update(id, patch) {
        const [updated] = await drz
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        if (!updated) throw new Error("Booking not found");
        return updated;
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return drz
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      async getById(id) {
        const [row] = await drz.select().from(schema.invoices).where(eq(schema.invoices.id, id));
        return row ?? null;
      },
      async countByStudio(studioId) {
        const [row] = await drz
          .select({ count: sql<number>`count(*)` })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return row?.count ?? 0;
      },
      async insert(invoice) {
        const [inserted] = await drz.insert(schema.invoices).values(invoice).returning();
        return inserted;
      },
      async update(id, patch) {
        const [updated] = await drz
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        if (!updated) throw new Error("Invoice not found");
        return updated;
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return drz
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        const inserted: typeof items = [];
        for (const batch of chunk(items, INSERT_MANY_CHUNK_SIZE)) {
          inserted.push(...(await drz.insert(schema.invoiceLineItems).values(batch).returning()));
        }
        return inserted;
      },
    },
    outbox: {
      async insert(row) {
        const [inserted] = await drz.insert(schema.notificationOutbox).values(row).returning();
        return inserted;
      },
      async listPending() {
        return drz
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch) {
        const [updated] = await drz
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        if (!updated) throw new Error("Outbox row not found");
        return updated;
      },
    },
  };
}
