import { and, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { AnySQLiteColumn, AnySQLiteTable } from "drizzle-orm/sqlite-core";
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
import { toCamelRow } from "./mapping";
import * as tables from "./schema";
import type { Repositories } from "./types";

export function createD1Repositories(db: D1Database): Repositories {
  const database = drizzle(db, { schema: tables.schema });

  function normalizeRow<T>(row: Record<string, unknown>): T {
    const values = Object.values(row);
    const unwrapped = values.length === 1 && isRecord(values[0]) ? values[0] : row;
    return toCamelRow<T>(unwrapped);
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  async function insertReturning<T>(table: AnySQLiteTable, row: T): Promise<T> {
    const [inserted] = await database.insert(table).values(row as never).returning();
    return normalizeRow<T>(inserted as Record<string, unknown>);
  }

  async function updateReturning<T>(
    table: AnySQLiteTable,
    column: AnySQLiteColumn,
    value: string,
    patch: Partial<T>,
  ): Promise<T> {
    const [updated] = await database
      .update(table)
      .set(patch as never)
      .where(eq(column, value))
      .returning();
    return normalizeRow<T>(updated as Record<string, unknown>);
  }

  async function selectOne<T>(query: PromiseLike<Record<string, unknown>[]>): Promise<T | null> {
    const [row] = await query;
    return row ? normalizeRow<T>(row) : null;
  }

  function selectMany<T>(rows: Record<string, unknown>[]): T[] {
    return rows.map((row) => normalizeRow<T>(row));
  }

  return {
    studios: {
      getFirst: async () => selectOne<Studio>(database.select().from(tables.studios).limit(1)),
    },
    settings: {
      getByStudioId: (studioId) =>
        selectOne<StudioSettings>(
          database.select().from(tables.studioSettings).where(eq(tables.studioSettings.studioId, studioId)),
        ),
      update: (studioId, patch) =>
        updateReturning<StudioSettings>(tables.studioSettings, tables.studioSettings.studioId, studioId, patch),
    },
    members: {
      listByStudio: async (studioId) =>
        selectMany<Member>(
          await database.select().from(tables.members).where(eq(tables.members.studioId, studioId)).orderBy(tables.members.name),
        ),
      getById: (id) => selectOne<Member>(database.select().from(tables.members).where(eq(tables.members.id, id))),
      findByEmail: (studioId, email) =>
        selectOne<Member>(
          database
            .select()
            .from(tables.members)
            .where(and(eq(tables.members.studioId, studioId), eq(tables.members.email, email))),
        ),
      insert: (member) => insertReturning<Member>(tables.members, member),
      update: (id, patch) => updateReturning<Member>(tables.members, tables.members.id, id, patch),
    },
    classTypes: {
      listByStudio: async (studioId) =>
        selectMany<ClassType>(
          await database
            .select()
            .from(tables.classTypes)
            .where(eq(tables.classTypes.studioId, studioId))
            .orderBy(tables.classTypes.name),
        ),
      getById: (id) => selectOne<ClassType>(database.select().from(tables.classTypes).where(eq(tables.classTypes.id, id))),
      insert: (classType) => insertReturning<ClassType>(tables.classTypes, classType),
    },
    classSessions: {
      listByStudio: async (studioId, range = {}) => {
        const conditions = [eq(tables.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(tables.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(tables.classSessions.startsAt, range.to));
        return selectMany<ClassSession>(
          await database
            .select()
            .from(tables.classSessions)
            .where(and(...conditions))
            .orderBy(tables.classSessions.startsAt),
        );
      },
      getById: (id) => selectOne<ClassSession>(database.select().from(tables.classSessions).where(eq(tables.classSessions.id, id))),
      insert: (session) => insertReturning<ClassSession>(tables.classSessions, session),
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return selectMany<Booking>(await database.select().from(tables.bookings).where(inArray(tables.bookings.sessionId, sessionIds)));
      },
      listBySession: async (sessionId) =>
        selectMany<Booking>(await database.select().from(tables.bookings).where(eq(tables.bookings.sessionId, sessionId))),
      getById: (id) => selectOne<Booking>(database.select().from(tables.bookings).where(eq(tables.bookings.id, id))),
      insert: (booking) => insertReturning<Booking>(tables.bookings, booking),
      update: (id, patch) => updateReturning<Booking>(tables.bookings, tables.bookings.id, id, patch),
    },
    invoices: {
      listByStudio: async (studioId) =>
        selectMany<Invoice>(
          await database.select().from(tables.invoices).where(eq(tables.invoices.studioId, studioId)).orderBy(desc(tables.invoices.issuedAt)),
        ),
      getById: (id) => selectOne<Invoice>(database.select().from(tables.invoices).where(eq(tables.invoices.id, id))),
      countByStudio: async (studioId) => {
        const [result] = await database.select({ count: count() }).from(tables.invoices).where(eq(tables.invoices.studioId, studioId));
        return result?.count ?? 0;
      },
      insert: (invoice) => insertReturning<Invoice>(tables.invoices, invoice),
      update: (id, patch) => updateReturning<Invoice>(tables.invoices, tables.invoices.id, id, patch),
    },
    invoiceLineItems: {
      listByInvoice: async (invoiceId) =>
        selectMany<InvoiceLineItem>(await database.select().from(tables.invoiceLineItems).where(eq(tables.invoiceLineItems.invoiceId, invoiceId))),
      insertMany: async (items) => {
        if (items.length === 0) return [];
        const values = items.map(
          (item) =>
            item as unknown as InferInsertModel<typeof tables.invoiceLineItems>,
        );
        const rows = await database.insert(tables.invoiceLineItems).values(values).returning();
        return selectMany<InvoiceLineItem>(rows as Record<string, unknown>[]);
      },
    },
    outbox: {
      insert: (row) => insertReturning<NotificationOutboxRow>(tables.notificationOutbox, row),
      listPending: async () =>
        selectMany<NotificationOutboxRow>(await database.select().from(tables.notificationOutbox).where(isNull(tables.notificationOutbox.sentAt))),
      update: (id, patch) => updateReturning<NotificationOutboxRow>(tables.notificationOutbox, tables.notificationOutbox.id, id, patch),
    },
  };
}
