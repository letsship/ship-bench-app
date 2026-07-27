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
  StudioSettings,
} from "../types";
import * as schema from "./schema";
import type { Repositories } from "./types";

// The production repository implementation over Drizzle ORM + Cloudflare D1.
// Every column in ./schema.ts maps 1:1 to its domain field, so rows read back
// already match the entity shapes in ../types — no camel/snake mapping layer,
// unlike the Supabase implementation it replaces.

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
          .where(eq(schema.studioSettings.studioId, studioId))
          .limit(1);
        return row ?? null;
      },
      async update(studioId, patch) {
        const [row] = await drz
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return row as StudioSettings;
      },
    },
    members: {
      async listByStudio(studioId) {
        return drz
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
      },
      async getById(id) {
        const [row] = await drz
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))
          .limit(1);
        return row ?? null;
      },
      async findByEmail(studioId, email) {
        const [row] = await drz
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
          .limit(1);
        return row ?? null;
      },
      async insert(member) {
        const [row] = await drz.insert(schema.members).values(member).returning();
        return row as Member;
      },
      async update(id, patch) {
        const [row] = await drz
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        return row as Member;
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return drz
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
      },
      async getById(id) {
        const [row] = await drz
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id))
          .limit(1);
        return row ?? null;
      },
      async insert(classType) {
        const [row] = await drz.insert(schema.classTypes).values(classType).returning();
        return row as ClassType;
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
          .where(eq(schema.classSessions.id, id))
          .limit(1);
        return row ?? null;
      },
      async insert(session) {
        const [row] = await drz.insert(schema.classSessions).values(session).returning();
        return row as ClassSession;
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
        const [row] = await drz
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id))
          .limit(1);
        return row ?? null;
      },
      async insert(booking) {
        const [row] = await drz.insert(schema.bookings).values(booking).returning();
        return row as Booking;
      },
      async update(id, patch) {
        const [row] = await drz
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        return row as Booking;
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
        const [row] = await drz
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id))
          .limit(1);
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
        const [row] = await drz.insert(schema.invoices).values(invoice).returning();
        return row as Invoice;
      },
      async update(id, patch) {
        const [row] = await drz
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        return row as Invoice;
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
        const rows = await drz.insert(schema.invoiceLineItems).values(items).returning();
        return rows as InvoiceLineItem[];
      },
    },
    outbox: {
      async insert(row) {
        const [inserted] = await drz.insert(schema.notificationOutbox).values(row).returning();
        return inserted as NotificationOutboxRow;
      },
      async listPending() {
        return drz
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch) {
        const [row] = await drz
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return row as NotificationOutboxRow;
      },
    },
  };
}
