import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import * as schema from "../schema";
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
import type { Repositories } from "./types";

// The production repository implementation over Drizzle ORM + Cloudflare D1.
// `createDrizzleRepositories` holds all the query logic against a plain Drizzle
// handle so it can be exercised in tests over an in-memory SQLite database (see
// `d1.test.ts`); `createD1Repositories` is the thin public factory that wraps
// the Worker's D1 binding. This is the ONE pair of factories a
// D1→other-database migration would rewrite — nothing above the repository
// interface changes.

export function createDrizzleRepositories<TResultKind extends "sync" | "async">(
  db: BaseSQLiteDatabase<TResultKind, unknown>,
): Repositories {
  return {
    studios: {
      async getFirst() {
        const [row] = await db.select().from(schema.studios).limit(1);
        return (row as Studio | undefined) ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const [row] = await db
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return (row as StudioSettings | undefined) ?? null;
      },
      async update(studioId, patch) {
        const [row] = await db
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return row as StudioSettings;
      },
    },
    members: {
      async listByStudio(studioId) {
        const rows = await db
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
        return rows as Member[];
      },
      async getById(id) {
        const [row] = await db.select().from(schema.members).where(eq(schema.members.id, id));
        return (row as Member | undefined) ?? null;
      },
      async findByEmail(studioId, email) {
        const [row] = await db
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return (row as Member | undefined) ?? null;
      },
      async insert(member) {
        const [row] = await db.insert(schema.members).values(member).returning();
        return row as Member;
      },
      async update(id, patch) {
        const [row] = await db
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        return row as Member;
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        const rows = await db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
        return rows as ClassType[];
      },
      async getById(id) {
        const [row] = await db.select().from(schema.classTypes).where(eq(schema.classTypes.id, id));
        return (row as ClassType | undefined) ?? null;
      },
      async insert(classType) {
        const [row] = await db.insert(schema.classTypes).values(classType).returning();
        return row as ClassType;
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        const rows = await db
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
        return rows as ClassSession[];
      },
      async getById(id) {
        const [row] = await db
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return (row as ClassSession | undefined) ?? null;
      },
      async insert(session) {
        const [row] = await db.insert(schema.classSessions).values(session).returning();
        return row as ClassSession;
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        const rows = await db
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
        return rows as Booking[];
      },
      async listBySession(sessionId) {
        const rows = await db
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
        return rows as Booking[];
      },
      async getById(id) {
        const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return (row as Booking | undefined) ?? null;
      },
      async insert(booking) {
        const [row] = await db.insert(schema.bookings).values(booking).returning();
        return row as Booking;
      },
      async update(id, patch) {
        const [row] = await db
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        return row as Booking;
      },
    },
    invoices: {
      async listByStudio(studioId) {
        const rows = await db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
        return rows as Invoice[];
      },
      async getById(id) {
        const [row] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
        return (row as Invoice | undefined) ?? null;
      },
      async countByStudio(studioId) {
        const rows = await db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows.length;
      },
      async insert(invoice) {
        const [row] = await db.insert(schema.invoices).values(invoice).returning();
        return row as Invoice;
      },
      async update(id, patch) {
        const [row] = await db
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        return row as Invoice;
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        const rows = await db
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
        return rows as InvoiceLineItem[];
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        const rows = await db.insert(schema.invoiceLineItems).values(items).returning();
        return rows as InvoiceLineItem[];
      },
    },
    outbox: {
      async insert(row) {
        const [inserted] = await db.insert(schema.notificationOutbox).values(row).returning();
        return inserted as NotificationOutboxRow;
      },
      async listPending() {
        const rows = await db
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
        return rows as NotificationOutboxRow[];
      },
      async update(id, patch) {
        const [row] = await db
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return row as NotificationOutboxRow;
      },
    },
  };
}

export function createD1Repositories(db: D1Database): Repositories {
  return createDrizzleRepositories(drizzle(db));
}
