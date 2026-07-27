import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray, isNull, gte, lt, desc, count, type InferInsertModel } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
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
import * as schema from "./schema";
import type { Repositories } from "./types";

// Production repository implementation over Drizzle + D1. This adapter takes
// a D1 database binding and implements the Repositories interface with the same
// behavior as the Supabase version: same ordering, filtering, and full-row
// returns on insert/update. The D1 binding is the ONLY constructor argument so
// the adapter can target any D1 instance (production, preview, or test).

function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function toSnake(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  return {
    studios: {
      async getFirst() {
        const result = await drizzleDb.select().from(schema.studios).limit(1);
        return result.length > 0
          ? (toCamel(result[0] as Record<string, unknown>) as unknown as Studio)
          : null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return result.length > 0
          ? (toCamel(result[0] as Record<string, unknown>) as unknown as StudioSettings)
          : null;
      },
      async update(studioId, patch) {
        await drizzleDb
          .update(schema.studioSettings)
          .set(
            toSnake(patch as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.studioSettings
            >,
          )
          .where(eq(schema.studioSettings.studioId, studioId));
        const result = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return toCamel(result[0] as Record<string, unknown>) as unknown as StudioSettings;
      },
    },
    members: {
      async listByStudio(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name);
        return result.map((row) => toCamel(row as Record<string, unknown>) as unknown as Member);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id));
        return result.length > 0
          ? (toCamel(result[0] as Record<string, unknown>) as unknown as Member)
          : null;
      },
      async findByEmail(studioId, email) {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return result.length > 0
          ? (toCamel(result[0] as Record<string, unknown>) as unknown as Member)
          : null;
      },
      async insert(member) {
        await drizzleDb
          .insert(schema.members)
          .values(
            toSnake(member as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.members
            >,
          );
        return member;
      },
      async update(id, patch) {
        await drizzleDb
          .update(schema.members)
          .set(
            toSnake(patch as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.members
            >,
          )
          .where(eq(schema.members.id, id));
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id));
        return toCamel(result[0] as Record<string, unknown>) as unknown as Member;
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name);
        return result.map((row) => toCamel(row as Record<string, unknown>) as unknown as ClassType);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return result.length > 0
          ? (toCamel(result[0] as Record<string, unknown>) as unknown as ClassType)
          : null;
      },
      async insert(classType) {
        await drizzleDb
          .insert(schema.classTypes)
          .values(
            toSnake(classType as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.classTypes
            >,
          );
        return classType;
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions: ReturnType<typeof eq>[] = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));

        const result = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.startsAt);
        return result.map(
          (row) => toCamel(row as Record<string, unknown>) as unknown as ClassSession,
        );
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return result.length > 0
          ? (toCamel(result[0] as Record<string, unknown>) as unknown as ClassSession)
          : null;
      },
      async insert(session) {
        await drizzleDb
          .insert(schema.classSessions)
          .values(
            toSnake(session as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.classSessions
            >,
          );
        return session;
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
        return result.map((row) => toCamel(row as Record<string, unknown>) as unknown as Booking);
      },
      async listBySession(sessionId) {
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
        return result.map((row) => toCamel(row as Record<string, unknown>) as unknown as Booking);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id));
        return result.length > 0
          ? (toCamel(result[0] as Record<string, unknown>) as unknown as Booking)
          : null;
      },
      async insert(booking) {
        await drizzleDb
          .insert(schema.bookings)
          .values(
            toSnake(booking as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.bookings
            >,
          );
        return booking;
      },
      async update(id, patch) {
        await drizzleDb
          .update(schema.bookings)
          .set(
            toSnake(patch as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.bookings
            >,
          )
          .where(eq(schema.bookings.id, id));
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id));
        return toCamel(result[0] as Record<string, unknown>) as unknown as Booking;
      },
    },
    invoices: {
      async listByStudio(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
        return result.map((row) => toCamel(row as Record<string, unknown>) as unknown as Invoice);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id));
        return result.length > 0
          ? (toCamel(result[0] as Record<string, unknown>) as unknown as Invoice)
          : null;
      },
      async countByStudio(studioId) {
        const result = await drizzleDb
          .select({ count: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return result[0]?.count ?? 0;
      },
      async insert(invoice) {
        await drizzleDb
          .insert(schema.invoices)
          .values(
            toSnake(invoice as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.invoices
            >,
          );
        return invoice;
      },
      async update(id, patch) {
        await drizzleDb
          .update(schema.invoices)
          .set(
            toSnake(patch as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.invoices
            >,
          )
          .where(eq(schema.invoices.id, id));
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id));
        return toCamel(result[0] as Record<string, unknown>) as unknown as Invoice;
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        const result = await drizzleDb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
        return result.map(
          (row) => toCamel(row as Record<string, unknown>) as unknown as InvoiceLineItem,
        );
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        await drizzleDb
          .insert(schema.invoiceLineItems)
          .values(
            items.map((item) =>
              toSnake(item as unknown as Record<string, unknown>),
            ) as unknown as InferInsertModel<typeof schema.invoiceLineItems>[],
          );
        return items;
      },
    },
    outbox: {
      async insert(row) {
        await drizzleDb
          .insert(schema.notificationOutbox)
          .values(
            toSnake(row as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.notificationOutbox
            >,
          );
        return row;
      },
      async listPending() {
        const result = await drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
        return result.map(
          (row) => toCamel(row as Record<string, unknown>) as unknown as NotificationOutboxRow,
        );
      },
      async update(id, patch) {
        await drizzleDb
          .update(schema.notificationOutbox)
          .set(
            toSnake(patch as unknown as Record<string, unknown>) as unknown as InferInsertModel<
              typeof schema.notificationOutbox
            >,
          )
          .where(eq(schema.notificationOutbox.id, id));
        const result = await drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(eq(schema.notificationOutbox.id, id));
        return toCamel(result[0] as Record<string, unknown>) as unknown as NotificationOutboxRow;
      },
    },
  };
}
