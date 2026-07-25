import { and, count, eq, inArray, isNull, lt, gte, desc, SQL, type Table } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types/experimental";
import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  Member,
  NotificationOutboxRow,
  StudioSettings,
} from "../types";
import type { Repositories } from "./types";
import { schema } from "./schema";

type DrizzleTable = Table;

// Production repository implementation over Cloudflare D1 using Drizzle.
// Mirrors the exact behaviour of the Supabase adapter: members ordered by name,
// sessions filtered inclusive-from/exclusive-to and ordered by starts_at,
// invoices ordered by issued_at desc, empty-input short-circuits in
// bookings.listBySessionIds and invoiceLineItems.insertMany, outbox.listPending
// filtering sent_at IS NULL, .returning() for insert/update, and a count
// expression for invoices.countByStudio.

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  async function insertReturning<T>(table: DrizzleTable, row: Record<string, unknown>): Promise<T> {
    // Drizzle expects camelCase keys matching schema properties; it handles mapping to snake_case columns.
    const result = await drizzleDb
      .insert(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values(row as any)
      .returning()
      .get();
    if (!result) {
      throw new Error(`Insert failed for table`);
    }
    return result as T;
  }

  async function updateReturning<T>(
    table: DrizzleTable,
    whereCondition: SQL,
    patch: Record<string, unknown>,
  ): Promise<T> {
    // Drizzle expects camelCase keys matching schema properties; it handles mapping to snake_case columns.
    const result = await drizzleDb
      .update(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(patch as any)
      .where(whereCondition)
      .returning()
      .get();
    if (!result) {
      throw new Error(`Update failed for table`);
    }
    return result as T;
  }

  return {
    studios: {
      async getFirst() {
        const result = await drizzleDb.select().from(schema.studiosTable).limit(1).get();
        return result ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.studioSettingsTable)
          .where(eq(schema.studioSettingsTable.studioId, studioId))
          .get();
        return result ?? null;
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
        return await drizzleDb
          .select()
          .from(schema.membersTable)
          .where(eq(schema.membersTable.studioId, studioId))
          .orderBy(schema.membersTable.name)
          .all();
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.membersTable)
          .where(eq(schema.membersTable.id, id))
          .get();
        return result ?? null;
      },
      async findByEmail(studioId, email) {
        const result = await drizzleDb
          .select()
          .from(schema.membersTable)
          .where(
            and(eq(schema.membersTable.studioId, studioId), eq(schema.membersTable.email, email)),
          )
          .get();
        return result ?? null;
      },
      async insert(member) {
        return insertReturning<Member>(
          schema.membersTable,
          member as unknown as Record<string, unknown>,
        );
      },
      async update(id, patch) {
        return updateReturning<Member>(schema.membersTable, eq(schema.membersTable.id, id), patch);
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return await drizzleDb
          .select()
          .from(schema.classTypesTable)
          .where(eq(schema.classTypesTable.studioId, studioId))
          .orderBy(schema.classTypesTable.name)
          .all();
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.classTypesTable)
          .where(eq(schema.classTypesTable.id, id))
          .get();
        return result ?? null;
      },
      async insert(classType) {
        return insertReturning<ClassType>(
          schema.classTypesTable,
          classType as unknown as Record<string, unknown>,
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
        return await drizzleDb
          .select()
          .from(schema.classSessionsTable)
          .where(whereClause)
          .orderBy(schema.classSessionsTable.startsAt)
          .all();
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.classSessionsTable)
          .where(eq(schema.classSessionsTable.id, id))
          .get();
        return result ?? null;
      },
      async insert(session) {
        return insertReturning<ClassSession>(
          schema.classSessionsTable,
          session as unknown as Record<string, unknown>,
        );
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        return await drizzleDb
          .select()
          .from(schema.bookingsTable)
          .where(inArray(schema.bookingsTable.sessionId, sessionIds))
          .all();
      },
      async listBySession(sessionId) {
        return await drizzleDb
          .select()
          .from(schema.bookingsTable)
          .where(eq(schema.bookingsTable.sessionId, sessionId))
          .all();
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.bookingsTable)
          .where(eq(schema.bookingsTable.id, id))
          .get();
        return result ?? null;
      },
      async insert(booking) {
        return insertReturning<Booking>(
          schema.bookingsTable,
          booking as unknown as Record<string, unknown>,
        );
      },
      async update(id, patch) {
        return updateReturning<Booking>(
          schema.bookingsTable,
          eq(schema.bookingsTable.id, id),
          patch,
        );
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return await drizzleDb
          .select()
          .from(schema.invoicesTable)
          .where(eq(schema.invoicesTable.studioId, studioId))
          .orderBy(desc(schema.invoicesTable.issuedAt))
          .all();
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.invoicesTable)
          .where(eq(schema.invoicesTable.id, id))
          .get();
        return result ?? null;
      },
      async countByStudio(studioId) {
        const result = await drizzleDb
          .select({ count: count() })
          .from(schema.invoicesTable)
          .where(eq(schema.invoicesTable.studioId, studioId))
          .get();
        return (result?.count as number) ?? 0;
      },
      async insert(invoice) {
        return insertReturning<Invoice>(
          schema.invoicesTable,
          invoice as unknown as Record<string, unknown>,
        );
      },
      async update(id, patch) {
        return updateReturning<Invoice>(
          schema.invoicesTable,
          eq(schema.invoicesTable.id, id),
          patch,
        );
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return await drizzleDb
          .select()
          .from(schema.invoiceLineItemsTable)
          .where(eq(schema.invoiceLineItemsTable.invoiceId, invoiceId))
          .all();
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        // Drizzle expects camelCase keys matching schema properties; it handles mapping to snake_case columns.
        const result = await drizzleDb
          .insert(schema.invoiceLineItemsTable)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values(items as any)
          .returning()
          .all();
        if (!result || result.length === 0) {
          throw new Error("insertMany failed for invoice_line_items");
        }
        return result;
      },
    },
    outbox: {
      async insert(row) {
        return insertReturning<NotificationOutboxRow>(
          schema.notificationOutboxTable,
          row as unknown as Record<string, unknown>,
        );
      },
      async listPending() {
        return await drizzleDb
          .select()
          .from(schema.notificationOutboxTable)
          .where(isNull(schema.notificationOutboxTable.sentAt))
          .all();
      },
      async update(id, patch) {
        return updateReturning<NotificationOutboxRow>(
          schema.notificationOutboxTable,
          eq(schema.notificationOutboxTable.id, id),
          patch,
        );
      },
    },
  };
}
