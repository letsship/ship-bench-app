import { and, asc, count, desc, eq, gte, inArray, isNull, lt, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
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
} from "./schema";
import type { Repositories } from "./types";

// The production repository implementation: Drizzle ORM over the Worker's
// Cloudflare D1 binding. The schema declares snake_case columns with camelCase
// field names, so rows come back already shaped as the entity types — no row
// mapping needed. This is the ONE file a database migration rewrites; nothing
// above the repository interface changes.

function fail(context: string): never {
  throw new Error(`D1 ${context} failed: no row returned`);
}

const first = <T>(rows: T[]): T | null => rows[0] ?? null;

export function createD1Repositories(db: D1Database): Repositories {
  const orm = drizzle(db);

  async function insertReturning<T>(table: SQLiteTable, row: T, context: string): Promise<T> {
    const inserted = (await orm
      .insert(table)
      .values(row as never)
      .returning()) as T[];
    return inserted[0] ?? fail(`insert into ${context}`);
  }

  async function updateReturning<T>(
    table: SQLiteTable,
    column: SQLiteColumn,
    value: string,
    patch: Partial<T>,
    context: string,
  ): Promise<T> {
    const updated = (await orm
      .update(table)
      .set(patch as never)
      .where(eq(column, value))
      .returning()) as T[];
    return updated[0] ?? fail(`update ${context}`);
  }

  return {
    studios: {
      async getFirst() {
        return first<Studio>(await orm.select().from(studios).limit(1));
      },
    },
    settings: {
      async getByStudioId(studioId) {
        return first<StudioSettings>(
          await orm.select().from(studioSettings).where(eq(studioSettings.studioId, studioId)),
        );
      },
      update: (studioId, patch) =>
        updateReturning<StudioSettings>(
          studioSettings,
          studioSettings.studioId,
          studioId,
          patch,
          "studio_settings",
        ),
    },
    members: {
      listByStudio: (studioId) =>
        orm.select().from(members).where(eq(members.studioId, studioId)).orderBy(asc(members.name)),
      async getById(id) {
        return first<Member>(await orm.select().from(members).where(eq(members.id, id)));
      },
      async findByEmail(studioId, email) {
        return first<Member>(
          await orm
            .select()
            .from(members)
            .where(and(eq(members.studioId, studioId), eq(members.email, email))),
        );
      },
      insert: (member) => insertReturning(members, member, "members"),
      update: (id, patch) => updateReturning<Member>(members, members.id, id, patch, "members"),
    },
    classTypes: {
      listByStudio: (studioId) =>
        orm
          .select()
          .from(classTypes)
          .where(eq(classTypes.studioId, studioId))
          .orderBy(asc(classTypes.name)),
      async getById(id) {
        return first<ClassType>(await orm.select().from(classTypes).where(eq(classTypes.id, id)));
      },
      insert: (classType) => insertReturning(classTypes, classType, "class_types"),
    },
    classSessions: {
      listByStudio: (studioId, range = {}) => {
        const filters: SQL[] = [eq(classSessions.studioId, studioId)];
        if (range.from) filters.push(gte(classSessions.startsAt, range.from));
        if (range.to) filters.push(lt(classSessions.startsAt, range.to));
        return orm
          .select()
          .from(classSessions)
          .where(and(...filters))
          .orderBy(asc(classSessions.startsAt));
      },
      async getById(id) {
        return first<ClassSession>(
          await orm.select().from(classSessions).where(eq(classSessions.id, id)),
        );
      },
      insert: (session) => insertReturning(classSessions, session, "class_sessions"),
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return orm.select().from(bookings).where(inArray(bookings.sessionId, sessionIds));
      },
      listBySession: (sessionId) =>
        orm.select().from(bookings).where(eq(bookings.sessionId, sessionId)),
      async getById(id) {
        return first<Booking>(await orm.select().from(bookings).where(eq(bookings.id, id)));
      },
      insert: (booking) => insertReturning(bookings, booking, "bookings"),
      update: (id, patch) => updateReturning<Booking>(bookings, bookings.id, id, patch, "bookings"),
    },
    invoices: {
      listByStudio: (studioId) =>
        orm
          .select()
          .from(invoices)
          .where(eq(invoices.studioId, studioId))
          .orderBy(desc(invoices.issuedAt)),
      async getById(id) {
        return first<Invoice>(await orm.select().from(invoices).where(eq(invoices.id, id)));
      },
      async countByStudio(studioId) {
        const rows = await orm
          .select({ value: count() })
          .from(invoices)
          .where(eq(invoices.studioId, studioId));
        return rows[0]?.value ?? 0;
      },
      insert: (invoice) => insertReturning(invoices, invoice, "invoices"),
      update: (id, patch) => updateReturning<Invoice>(invoices, invoices.id, id, patch, "invoices"),
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        orm.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId)),
      async insertMany(items) {
        if (items.length === 0) return [];
        return (await orm
          .insert(invoiceLineItems)
          .values(items as never)
          .returning()) as InvoiceLineItem[];
      },
    },
    outbox: {
      insert: (row) => insertReturning(notificationOutbox, row, "notification_outbox"),
      listPending: () =>
        orm.select().from(notificationOutbox).where(isNull(notificationOutbox.sentAt)),
      update: (id, patch) =>
        updateReturning<NotificationOutboxRow>(
          notificationOutbox,
          notificationOutbox.id,
          id,
          patch,
          "notification_outbox",
        ),
    },
  };
}
