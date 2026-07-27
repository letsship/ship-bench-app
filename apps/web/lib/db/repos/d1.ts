import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  bookings,
  classSessions,
  classTypes,
  invoiceLineItems,
  invoices,
  members,
  notificationOutbox,
  schema,
  studioSettings,
  studios,
} from "../schema";
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

// The production repository implementation over Drizzle ORM + the Cloudflare D1
// binding. Column mapping (camelCase entity <-> snake_case column) is handled by
// the Drizzle schema (../schema.ts), not a runtime transform. This is the ONE
// file a D1 -> other-database migration rewrites — nothing above the repository
// interface changes.

export function createD1Repositories(db: D1Database): Repositories {
  const orm = drizzle(db, { schema });

  return {
    studios: {
      async getFirst() {
        const [row] = await orm.select().from(studios).limit(1);
        return (row as Studio | undefined) ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const [row] = await orm
          .select()
          .from(studioSettings)
          .where(eq(studioSettings.studioId, studioId));
        return (row as StudioSettings | undefined) ?? null;
      },
      async update(studioId, patch) {
        const [row] = await orm
          .update(studioSettings)
          .set(patch)
          .where(eq(studioSettings.studioId, studioId))
          .returning();
        return row as StudioSettings;
      },
    },
    members: {
      async listByStudio(studioId) {
        const rows = await orm
          .select()
          .from(members)
          .where(eq(members.studioId, studioId))
          .orderBy(asc(members.name));
        return rows as Member[];
      },
      async getById(id) {
        const [row] = await orm.select().from(members).where(eq(members.id, id));
        return (row as Member | undefined) ?? null;
      },
      async findByEmail(studioId, email) {
        const [row] = await orm
          .select()
          .from(members)
          .where(and(eq(members.studioId, studioId), eq(members.email, email)));
        return (row as Member | undefined) ?? null;
      },
      async insert(member) {
        const [row] = await orm.insert(members).values(member).returning();
        return row as Member;
      },
      async update(id, patch) {
        const [row] = await orm.update(members).set(patch).where(eq(members.id, id)).returning();
        return row as Member;
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        const rows = await orm
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name));
        return rows as ClassType[];
      },
      async getById(id) {
        const [row] = await orm.select().from(classTypes).where(eq(classTypes.id, id));
        return (row as ClassType | undefined) ?? null;
      },
      async insert(classType) {
        const [row] = await orm.insert(classTypes).values(classType).returning();
        return row as ClassType;
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions = [eq(classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(classSessions.startsAt, range.to));
        const rows = await orm
          .select()
          .from(classSessions)
          .where(and(...conditions))
          .orderBy(asc(classSessions.startsAt));
        return rows as ClassSession[];
      },
      async getById(id) {
        const [row] = await orm.select().from(classSessions).where(eq(classSessions.id, id));
        return (row as ClassSession | undefined) ?? null;
      },
      async insert(session) {
        const [row] = await orm.insert(classSessions).values(session).returning();
        return row as ClassSession;
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        const rows = await orm
          .select()
          .from(bookings)
          .where(inArray(bookings.sessionId, sessionIds));
        return rows as Booking[];
      },
      async listBySession(sessionId) {
        const rows = await orm.select().from(bookings).where(eq(bookings.sessionId, sessionId));
        return rows as Booking[];
      },
      async getById(id) {
        const [row] = await orm.select().from(bookings).where(eq(bookings.id, id));
        return (row as Booking | undefined) ?? null;
      },
      async insert(booking) {
        const [row] = await orm.insert(bookings).values(booking).returning();
        return row as Booking;
      },
      async update(id, patch) {
        const [row] = await orm.update(bookings).set(patch).where(eq(bookings.id, id)).returning();
        return row as Booking;
      },
    },
    invoices: {
      async listByStudio(studioId) {
        const rows = await orm
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt));
        return rows as Invoice[];
      },
      async getById(id) {
        const [row] = await orm.select().from(invoices).where(eq(invoices.id, id));
        return (row as Invoice | undefined) ?? null;
      },
      async countByStudio(studioId) {
        const rows = await orm
          .select({ id: invoices.id })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return rows.length;
      },
      async insert(invoice) {
        const [row] = await orm.insert(invoices).values(invoice).returning();
        return row as Invoice;
      },
      async update(id, patch) {
        const [row] = await orm.update(invoices).set(patch).where(eq(invoices.id, id)).returning();
        return row as Invoice;
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        const rows = await orm
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoiceId));
        return rows as InvoiceLineItem[];
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        const rows = await orm.insert(invoiceLineItems).values(items).returning();
        return rows as InvoiceLineItem[];
      },
    },
    outbox: {
      async insert(row) {
        const [inserted] = await orm.insert(notificationOutbox).values(row).returning();
        return inserted as NotificationOutboxRow;
      },
      async listPending() {
        const rows = await orm
          .select()
          .from(notificationOutbox)
          .where(isNull(notificationOutbox.sentAt));
        return rows as NotificationOutboxRow[];
      },
      async update(id, patch) {
        const [row] = await orm
          .update(notificationOutbox)
          .set(patch)
          .where(eq(notificationOutbox.id, id))
          .returning();
        return row as NotificationOutboxRow;
      },
    },
  };
}
