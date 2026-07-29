import { and, count, desc, eq, gte, inArray, isNull, lt, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  Member,
  NotificationOutboxRow,
  Studio,
  StudioSettings,
} from "../types";
import * as schema from "./schema";
import type { Repositories } from "./types";

// The production repository implementation over Drizzle ORM + Cloudflare D1,
// replacing the old Supabase/Postgres adapter. Drizzle's column mapping turns
// snake_case columns straight into the camelCase entity types (see schema.ts),
// so no mapping layer is needed. Behaviour matches the in-memory fakes exactly:
// name-ordered member/class-type lists, `issued_at desc` invoices, the
// inclusive-from/exclusive-to session range, the empty-array short-circuits,
// and `sent_at IS NULL` for pending outbox rows.

// The D1 binding surface, declared structurally so the adapter (and its tests)
// don't depend on @cloudflare/workers-types globals. At runtime this is the
// real Workers `D1Database` binding; anything with this shape (e.g. the test
// shim over a local SQLite) works too.
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
}

const first = <T>(rows: T[]): T | null => rows[0] ?? null;

// Insert/update statements always RETURNING exactly one row; a missing row
// means an update matched nothing (same failure mode as the old `.single()`).
const one = <T>(rows: T[], context: string): T => {
  const row = rows[0];
  if (!row) throw new Error(`D1 ${context} returned no row`);
  return row;
};

export function createD1Repositories(db: D1Database): Repositories {
  const client = drizzle(db, { schema });

  return {
    studios: {
      getFirst: async () => first<Studio>(await client.select().from(schema.studios).limit(1)),
    },
    settings: {
      getByStudioId: async (studioId) =>
        first<StudioSettings>(
          await client
            .select()
            .from(schema.studioSettings)
            .where(eq(schema.studioSettings.studioId, studioId))
            .limit(1),
        ),
      update: async (studioId, patch) =>
        one<StudioSettings>(
          await client
            .update(schema.studioSettings)
            .set(patch)
            .where(eq(schema.studioSettings.studioId, studioId))
            .returning(),
          "settings.update",
        ),
    },
    members: {
      listByStudio: (studioId) =>
        client
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name),
      getById: async (id) =>
        first<Member>(
          await client.select().from(schema.members).where(eq(schema.members.id, id)).limit(1),
        ),
      findByEmail: async (studioId, email) =>
        first<Member>(
          await client
            .select()
            .from(schema.members)
            .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)))
            .limit(1),
        ),
      insert: async (member) =>
        one<Member>(
          await client.insert(schema.members).values(member).returning(),
          "members.insert",
        ),
      update: async (id, patch) =>
        one<Member>(
          await client
            .update(schema.members)
            .set(patch)
            .where(eq(schema.members.id, id))
            .returning(),
          "members.update",
        ),
    },
    classTypes: {
      listByStudio: (studioId) =>
        client
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name),
      getById: async (id) =>
        first<ClassType>(
          await client
            .select()
            .from(schema.classTypes)
            .where(eq(schema.classTypes.id, id))
            .limit(1),
        ),
      insert: async (classType) =>
        one<ClassType>(
          await client.insert(schema.classTypes).values(classType).returning(),
          "classTypes.insert",
        ),
    },
    classSessions: {
      listByStudio: (studioId, range = {}) => {
        const filters: SQL[] = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) filters.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) filters.push(lt(schema.classSessions.startsAt, range.to));
        return client
          .select()
          .from(schema.classSessions)
          .where(and(...filters))
          .orderBy(schema.classSessions.startsAt);
      },
      getById: async (id) =>
        first<ClassSession>(
          await client
            .select()
            .from(schema.classSessions)
            .where(eq(schema.classSessions.id, id))
            .limit(1),
        ),
      insert: async (session) =>
        one<ClassSession>(
          await client.insert(schema.classSessions).values(session).returning(),
          "classSessions.insert",
        ),
    },
    bookings: {
      listBySessionIds: async (sessionIds) => {
        if (sessionIds.length === 0) return [];
        return client
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      listBySession: (sessionId) =>
        client.select().from(schema.bookings).where(eq(schema.bookings.sessionId, sessionId)),
      getById: async (id) =>
        first<Booking>(
          await client.select().from(schema.bookings).where(eq(schema.bookings.id, id)).limit(1),
        ),
      insert: async (booking) =>
        one<Booking>(
          await client.insert(schema.bookings).values(booking).returning(),
          "bookings.insert",
        ),
      update: async (id, patch) =>
        one<Booking>(
          await client
            .update(schema.bookings)
            .set(patch)
            .where(eq(schema.bookings.id, id))
            .returning(),
          "bookings.update",
        ),
    },
    invoices: {
      listByStudio: (studioId) =>
        client
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt)),
      getById: async (id) =>
        first<Invoice>(
          await client.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1),
        ),
      countByStudio: async (studioId) => {
        const rows = await client
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return rows[0]?.value ?? 0;
      },
      insert: async (invoice) =>
        one<Invoice>(
          await client.insert(schema.invoices).values(invoice).returning(),
          "invoices.insert",
        ),
      update: async (id, patch) =>
        one<Invoice>(
          await client
            .update(schema.invoices)
            .set(patch)
            .where(eq(schema.invoices.id, id))
            .returning(),
          "invoices.update",
        ),
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        client
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId)),
      insertMany: async (items) => {
        if (items.length === 0) return [];
        return client.insert(schema.invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      insert: async (row) =>
        one<NotificationOutboxRow>(
          await client.insert(schema.notificationOutbox).values(row).returning(),
          "outbox.insert",
        ),
      listPending: () =>
        client
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt)),
      update: async (id, patch) =>
        one<NotificationOutboxRow>(
          await client
            .update(schema.notificationOutbox)
            .set(patch)
            .where(eq(schema.notificationOutbox.id, id))
            .returning(),
          "outbox.update",
        ),
    },
  };
}
