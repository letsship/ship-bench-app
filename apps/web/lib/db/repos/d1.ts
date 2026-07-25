import { and, count, eq, inArray, isNull, lt, gte, desc, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types/experimental";
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
import { toSnakeRow, toCamelRow } from "./mapping";
import type { Repositories } from "./types";
import { schema } from "./schema";

type D1Result = { success: boolean; results?: Record<string, unknown>[] };
type DrizzleTable = any;

// Production repository implementation over Cloudflare D1 using Drizzle.
// Mirrors the exact behaviour of the Supabase adapter: members ordered by name,
// sessions filtered inclusive-from/exclusive-to and ordered by starts_at,
// invoices ordered by issued_at desc, empty-input short-circuits in
// bookings.listBySessionIds and invoiceLineItems.insertMany, outbox.listPending
// filtering sent_at IS NULL, .returning() for insert/update, and a count
// expression for invoices.countByStudio.

function toEntity<T>(row: Record<string, unknown>): T {
  return toCamelRow<T>(row);
}

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  async function insertReturning<T>(table: DrizzleTable, row: Record<string, unknown>): Promise<T> {
    const result = (await drizzleDb.insert(table).values(row).returning().run()) as D1Result;
    if (!result.success || !result.results?.[0]) {
      throw new Error(`Insert failed for table`);
    }
    return toEntity<T>(result.results[0] as Record<string, unknown>);
  }

  async function updateReturning<T>(
    table: DrizzleTable,
    whereCondition: SQL,
    patch: Record<string, unknown>,
  ): Promise<T> {
    const result = (await drizzleDb
      .update(table)
      .set(patch)
      .where(whereCondition)
      .returning()
      .run()) as D1Result;
    if (!result.success || !result.results?.[0]) {
      throw new Error(`Update failed for table`);
    }
    return toEntity<T>(result.results[0] as Record<string, unknown>);
  }

  return {
    studios: {
      async getFirst() {
        const result = await drizzleDb.select().from(schema.studiosTable).limit(1).run();
        return result.results?.[0]
          ? toEntity<Studio>(result.results[0] as Record<string, unknown>)
          : null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const result = (await drizzleDb
          .select()
          .from(schema.studioSettingsTable)
          .where(eq(schema.studioSettingsTable.studioId, studioId))
          .run()) as D1Result;
        return result.results?.[0]
          ? toEntity<StudioSettings>(result.results[0] as Record<string, unknown>)
          : null;
      },
      async update(studioId, patch) {
        return updateReturning<StudioSettings>(
          schema.studioSettingsTable,
          eq(schema.studioSettingsTable.studioId, studioId),
          patch,
        );
      },
    },
    members: {
      async listByStudio(studioId) {
        const result = (await drizzleDb
          .select()
          .from(schema.membersTable)
          .where(eq(schema.membersTable.studioId, studioId))
          .orderBy(schema.membersTable.name)
          .run()) as D1Result;
        return (result.results ?? []).map((row: Record<string, unknown>) => toEntity<Member>(row));
      },
      async getById(id) {
        const result = (await drizzleDb
          .select()
          .from(schema.membersTable)
          .where(eq(schema.membersTable.id, id))
          .run()) as D1Result;
        return result.results?.[0]
          ? toEntity<Member>(result.results[0] as Record<string, unknown>)
          : null;
      },
      async findByEmail(studioId, email) {
        const result = (await drizzleDb
          .select()
          .from(schema.membersTable)
          .where(
            and(eq(schema.membersTable.studioId, studioId), eq(schema.membersTable.email, email)),
          )
          .run()) as D1Result;
        return result.results?.[0]
          ? toEntity<Member>(result.results[0] as Record<string, unknown>)
          : null;
      },
      async insert(member) {
        return insertReturning<Member>(
          schema.membersTable,
          toSnakeRow(member as unknown as Record<string, unknown>),
        );
      },
      async update(id, patch) {
        return updateReturning<Member>(
          schema.membersTable,
          eq(schema.membersTable.id, id),
          toSnakeRow(patch as unknown as Record<string, unknown>),
        );
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        const result = (await drizzleDb
          .select()
          .from(schema.classTypesTable)
          .where(eq(schema.classTypesTable.studioId, studioId))
          .orderBy(schema.classTypesTable.name)
          .run()) as D1Result;
        return (result.results ?? []).map((row: Record<string, unknown>) =>
          toEntity<ClassType>(row),
        );
      },
      async getById(id) {
        const result = (await drizzleDb
          .select()
          .from(schema.classTypesTable)
          .where(eq(schema.classTypesTable.id, id))
          .run()) as D1Result;
        return result.results?.[0]
          ? toEntity<ClassType>(result.results[0] as Record<string, unknown>)
          : null;
      },
      async insert(classType) {
        return insertReturning<ClassType>(
          schema.classTypesTable,
          toSnakeRow(classType as unknown as Record<string, unknown>),
        );
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        const conditions: SQL<unknown>[] = [eq(schema.classSessionsTable.studioId, studioId)];
        if (range.from) {
          conditions.push(gte(schema.classSessionsTable.startsAt, range.from));
        }
        if (range.to) {
          conditions.push(lt(schema.classSessionsTable.startsAt, range.to));
        }
        const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
        const result = (await drizzleDb
          .select()
          .from(schema.classSessionsTable)
          .where(whereClause)
          .orderBy(schema.classSessionsTable.startsAt)
          .run()) as D1Result;
        return (result.results ?? []).map((row: Record<string, unknown>) =>
          toEntity<ClassSession>(row),
        );
      },
      async getById(id) {
        const result = (await drizzleDb
          .select()
          .from(schema.classSessionsTable)
          .where(eq(schema.classSessionsTable.id, id))
          .run()) as D1Result;
        return result.results?.[0]
          ? toEntity<ClassSession>(result.results[0] as Record<string, unknown>)
          : null;
      },
      async insert(session) {
        return insertReturning<ClassSession>(
          schema.classSessionsTable,
          toSnakeRow(session as unknown as Record<string, unknown>),
        );
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        const result = (await drizzleDb
          .select()
          .from(schema.bookingsTable)
          .where(inArray(schema.bookingsTable.sessionId, sessionIds))
          .run()) as D1Result;
        return (result.results ?? []).map((row: Record<string, unknown>) => toEntity<Booking>(row));
      },
      async listBySession(sessionId) {
        const result = (await drizzleDb
          .select()
          .from(schema.bookingsTable)
          .where(eq(schema.bookingsTable.sessionId, sessionId))
          .run()) as D1Result;
        return (result.results ?? []).map((row: Record<string, unknown>) => toEntity<Booking>(row));
      },
      async getById(id) {
        const result = (await drizzleDb
          .select()
          .from(schema.bookingsTable)
          .where(eq(schema.bookingsTable.id, id))
          .run()) as D1Result;
        return result.results?.[0]
          ? toEntity<Booking>(result.results[0] as Record<string, unknown>)
          : null;
      },
      async insert(booking) {
        return insertReturning<Booking>(
          schema.bookingsTable,
          toSnakeRow(booking as unknown as Record<string, unknown>),
        );
      },
      async update(id, patch) {
        return updateReturning<Booking>(
          schema.bookingsTable,
          eq(schema.bookingsTable.id, id),
          toSnakeRow(patch as unknown as Record<string, unknown>),
        );
      },
    },
    invoices: {
      async listByStudio(studioId) {
        const result = (await drizzleDb
          .select()
          .from(schema.invoicesTable)
          .where(eq(schema.invoicesTable.studioId, studioId))
          .orderBy(desc(schema.invoicesTable.issuedAt))
          .run()) as D1Result;
        return (result.results ?? []).map((row: Record<string, unknown>) => toEntity<Invoice>(row));
      },
      async getById(id) {
        const result = (await drizzleDb
          .select()
          .from(schema.invoicesTable)
          .where(eq(schema.invoicesTable.id, id))
          .run()) as D1Result;
        return result.results?.[0]
          ? toEntity<Invoice>(result.results[0] as Record<string, unknown>)
          : null;
      },
      async countByStudio(studioId) {
        const result = (await drizzleDb
          .select({ count: count() })
          .from(schema.invoicesTable)
          .where(eq(schema.invoicesTable.studioId, studioId))
          .run()) as D1Result;
        const row = result.results?.[0] as Record<string, unknown> | undefined;
        return (row?.count as number) ?? 0;
      },
      async insert(invoice) {
        return insertReturning<Invoice>(
          schema.invoicesTable,
          toSnakeRow(invoice as unknown as Record<string, unknown>),
        );
      },
      async update(id, patch) {
        return updateReturning<Invoice>(
          schema.invoicesTable,
          eq(schema.invoicesTable.id, id),
          toSnakeRow(patch as unknown as Record<string, unknown>),
        );
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        const result = (await drizzleDb
          .select()
          .from(schema.invoiceLineItemsTable)
          .where(eq(schema.invoiceLineItemsTable.invoiceId, invoiceId))
          .run()) as D1Result;
        return (result.results ?? []).map((row: Record<string, unknown>) =>
          toEntity<InvoiceLineItem>(row),
        );
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        const snakeItems = items.map((item) =>
          toSnakeRow(item as unknown as Record<string, unknown>),
        );
        const result = (await drizzleDb
          .insert(schema.invoiceLineItemsTable)
          .values(snakeItems as any)
          .returning()
          .run()) as D1Result;
        if (!result.success || !result.results) {
          throw new Error("insertMany failed for invoice_line_items");
        }
        return (result.results ?? []).map((row: Record<string, unknown>) =>
          toEntity<InvoiceLineItem>(row),
        );
      },
    },
    outbox: {
      async insert(row) {
        return insertReturning<NotificationOutboxRow>(
          schema.notificationOutboxTable,
          toSnakeRow(row as unknown as Record<string, unknown>),
        );
      },
      async listPending() {
        const result = (await drizzleDb
          .select()
          .from(schema.notificationOutboxTable)
          .where(isNull(schema.notificationOutboxTable.sentAt))
          .run()) as D1Result;
        return (result.results ?? []).map((row: Record<string, unknown>) =>
          toEntity<NotificationOutboxRow>(row),
        );
      },
      async update(id, patch) {
        return updateReturning<NotificationOutboxRow>(
          schema.notificationOutboxTable,
          eq(schema.notificationOutboxTable.id, id),
          toSnakeRow(patch as unknown as Record<string, unknown>),
        );
      },
    },
  };
}
