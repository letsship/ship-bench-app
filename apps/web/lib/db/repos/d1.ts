import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../schema";
import type { Repositories } from "./types";

function maybeFirst<T>(rows: T[]): T | null {
  return rows[0] ?? null;
}

function requiredFirst<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) throw new Error(`${label} not found`);
  return row;
}

export function createD1Repositories(binding: D1Database): Repositories {
  const db = drizzle(binding, { schema });

  return {
    studios: {
      async getFirst() {
        return maybeFirst(await db.select().from(schema.studios).limit(1));
      },
    },
    settings: {
      async getByStudioId(studioId) {
        return maybeFirst(
          await db
            .select()
            .from(schema.studioSettings)
            .where(eq(schema.studioSettings.studioId, studioId))
            .limit(1),
        );
      },
      async update(studioId, patch) {
        return requiredFirst(
          await db
            .update(schema.studioSettings)
            .set(patch)
            .where(eq(schema.studioSettings.studioId, studioId))
            .returning(),
          "Studio settings",
        );
      },
    },
    members: {
      async listByStudio(studioId) {
        return db
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
      },
      async getById(id) {
        return maybeFirst(
          await db.select().from(schema.members).where(eq(schema.members.id, id)).limit(1),
        );
      },
      async findByEmail(studioId, email) {
        return maybeFirst(
          await db
            .select()
            .from(schema.members)
            .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
            .limit(1),
        );
      },
      async insert(member) {
        return requiredFirst(await db.insert(schema.members).values(member).returning(), "Member");
      },
      async update(id, patch) {
        return requiredFirst(
          await db.update(schema.members).set(patch).where(eq(schema.members.id, id)).returning(),
          "Member",
        );
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
      },
      async getById(id) {
        return maybeFirst(
          await db.select().from(schema.classTypes).where(eq(schema.classTypes.id, id)).limit(1),
        );
      },
      async insert(classType) {
        return requiredFirst(
          await db.insert(schema.classTypes).values(classType).returning(),
          "Class type",
        );
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const filters = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) filters.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) filters.push(lt(schema.classSessions.startsAt, range.to));
        return db
          .select()
          .from(schema.classSessions)
          .where(and(...filters))
          .orderBy(asc(schema.classSessions.startsAt));
      },
      async getById(id) {
        return maybeFirst(
          await db
            .select()
            .from(schema.classSessions)
            .where(eq(schema.classSessions.id, id))
            .limit(1),
        );
      },
      async insert(session) {
        return requiredFirst(
          await db.insert(schema.classSessions).values(session).returning(),
          "Class session",
        );
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return db
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId) {
        return db
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id) {
        return maybeFirst(
          await db.select().from(schema.bookings).where(eq(schema.bookings.id, id)).limit(1),
        );
      },
      async insert(booking) {
        return requiredFirst(
          await db.insert(schema.bookings).values(booking).returning(),
          "Booking",
        );
      },
      async update(id, patch) {
        return requiredFirst(
          await db.update(schema.bookings).set(patch).where(eq(schema.bookings.id, id)).returning(),
          "Booking",
        );
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      async getById(id) {
        return maybeFirst(
          await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1),
        );
      },
      async countByStudio(studioId) {
        const rows = await db
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows[0]?.value ?? 0;
      },
      async insert(invoice) {
        return requiredFirst(
          await db.insert(schema.invoices).values(invoice).returning(),
          "Invoice",
        );
      },
      async update(id, patch) {
        return requiredFirst(
          await db.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id)).returning(),
          "Invoice",
        );
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return db
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        return db.insert(schema.invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      async insert(row) {
        return requiredFirst(
          await db.insert(schema.notificationOutbox).values(row).returning(),
          "Outbox row",
        );
      },
      async listPending() {
        return db
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch) {
        return requiredFirst(
          await db
            .update(schema.notificationOutbox)
            .set(patch)
            .where(eq(schema.notificationOutbox.id, id))
            .returning(),
          "Outbox row",
        );
      },
    },
  };
}
