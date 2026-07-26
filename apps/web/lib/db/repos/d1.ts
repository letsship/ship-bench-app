import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
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
} from "../schema";
import type { Repositories } from "./types";

// The production repository implementation over Cloudflare D1 (Drizzle ORM).
// This is the ONE file a D1→other-database migration rewrites — nothing above
// the repository interface changes.

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db);

  return {
    studios: {
      async getFirst() {
        const [row] = await drizzleDb.select().from(studios).limit(1);
        return row ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const [row] = await drizzleDb
          .select()
          .from(studioSettings)
          .where(eq(studioSettings.studioId, studioId));
        return row ?? null;
      },
      async update(studioId, patch) {
        const [row] = await drizzleDb
          .update(studioSettings)
          .set(patch)
          .where(eq(studioSettings.studioId, studioId))
          .returning();
        return row;
      },
    },
    members: {
      async listByStudio(studioId) {
        return drizzleDb
          .select()
          .from(members)
          .where(eq(members.studioId, studioId))
          .orderBy(asc(members.name));
      },
      async getById(id) {
        const [row] = await drizzleDb.select().from(members).where(eq(members.id, id));
        return row ?? null;
      },
      async findByEmail(studioId, email) {
        const [row] = await drizzleDb
          .select()
          .from(members)
          .where(and(eq(members.studioId, studioId), eq(members.email, email)));
        return row ?? null;
      },
      async insert(member) {
        const [row] = await drizzleDb.insert(members).values(member).returning();
        return row;
      },
      async update(id, patch) {
        const [row] = await drizzleDb
          .update(members)
          .set(patch)
          .where(eq(members.id, id))
          .returning();
        return row;
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return drizzleDb
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name));
      },
      async getById(id) {
        const [row] = await drizzleDb.select().from(classTypes).where(eq(classTypes.id, id));
        return row ?? null;
      },
      async insert(classType) {
        const [row] = await drizzleDb.insert(classTypes).values(classType).returning();
        return row;
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(classSessions.startsAt, range.to));
        return drizzleDb
          .select()
          .from(classSessions)
          .where(and(...conditions))
          .orderBy(asc(classSessions.startsAt));
      },
      async getById(id) {
        const [row] = await drizzleDb.select().from(classSessions).where(eq(classSessions.id, id));
        return row ?? null;
      },
      async insert(session) {
        const [row] = await drizzleDb.insert(classSessions).values(session).returning();
        return row;
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return drizzleDb.select().from(bookings).where(inArray(bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId) {
        return drizzleDb.select().from(bookings).where(eq(bookings.sessionId, sessionId));
      },
      async getById(id) {
        const [row] = await drizzleDb.select().from(bookings).where(eq(bookings.id, id));
        return row ?? null;
      },
      async insert(booking) {
        const [row] = await drizzleDb.insert(bookings).values(booking).returning();
        return row;
      },
      async update(id, patch) {
        const [row] = await drizzleDb
          .update(bookings)
          .set(patch)
          .where(eq(bookings.id, id))
          .returning();
        return row;
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return drizzleDb
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt));
      },
      async getById(id) {
        const [row] = await drizzleDb.select().from(invoices).where(eq(invoices.id, id));
        return row ?? null;
      },
      async countByStudio(studioId) {
        const [row] = await drizzleDb
          .select({ count: sql<number>`count(*)` })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return row?.count ?? 0;
      },
      async insert(invoice) {
        const [row] = await drizzleDb.insert(invoices).values(invoice).returning();
        return row;
      },
      async update(id, patch) {
        const [row] = await drizzleDb
          .update(invoices)
          .set(patch)
          .where(eq(invoices.id, id))
          .returning();
        return row;
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return drizzleDb
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        return drizzleDb.insert(invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      async insert(row) {
        const [inserted] = await drizzleDb.insert(notificationOutbox).values(row).returning();
        return inserted;
      },
      async listPending() {
        return drizzleDb.select().from(notificationOutbox).where(isNull(notificationOutbox.sentAt));
      },
      async update(id, patch) {
        const [row] = await drizzleDb
          .update(notificationOutbox)
          .set(patch)
          .where(eq(notificationOutbox.id, id))
          .returning();
        return row;
      },
    },
  };
}
