import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
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
// Cloudflare D1 binding. The schema in `schema.ts` maps every snake_case column
// to its camelCase entity field, so rows come back as the entity types with no
// remapping. This is the ONE file a database migration rewrites — nothing above
// the repository interface changes.

function fail(context: string, cause: unknown): never {
  const message = cause instanceof Error ? cause.message : String(cause);
  throw new Error(`D1 ${context} failed: ${message}`);
}

async function run<T>(context: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    fail(context, error);
  }
}

// Always called inside `run`, which adds the `D1 <context> failed:` prefix.
function requireRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error("no row returned");
  return row;
}

export function createD1Repositories(binding: D1Database): Repositories {
  const db = drizzle(binding);

  async function insertReturning<T>(context: string, table: SQLiteTable, row: T): Promise<T> {
    return run(context, async () => {
      const inserted = await db
        .insert(table)
        .values(row as never)
        .returning();
      return requireRow(inserted as unknown[]) as T;
    });
  }

  // An empty patch is reachable (every field of the update schemas is
  // optional), and Drizzle rejects an `update().set({})` — so fall back to
  // simply reading the row back, which is what the other implementations do.
  async function updateReturning<T>(
    context: string,
    table: SQLiteTable,
    match: SQL,
    patch: Partial<T>,
  ): Promise<T> {
    return run(context, async () => {
      const rows =
        Object.keys(patch as object).length === 0
          ? await db.select().from(table).where(match)
          : await db
              .update(table)
              .set(patch as never)
              .where(match)
              .returning();
      return requireRow(rows as unknown[]) as T;
    });
  }

  return {
    studios: {
      getFirst: () =>
        run("studios.getFirst", async () => {
          const rows: Studio[] = await db.select().from(studios).limit(1);
          return rows[0] ?? null;
        }),
    },
    settings: {
      getByStudioId: (studioId) =>
        run("settings.getByStudioId", async () => {
          const rows: StudioSettings[] = await db
            .select()
            .from(studioSettings)
            .where(eq(studioSettings.studioId, studioId));
          return rows[0] ?? null;
        }),
      update: (studioId, patch) =>
        updateReturning<StudioSettings>(
          "settings.update",
          studioSettings,
          eq(studioSettings.studioId, studioId),
          patch,
        ),
    },
    members: {
      listByStudio: (studioId) =>
        run("members.listByStudio", () =>
          db
            .select()
            .from(members)
            .where(eq(members.studioId, studioId))
            .orderBy(asc(members.name)),
        ),
      getById: (id) =>
        run("members.getById", async () => {
          const rows: Member[] = await db.select().from(members).where(eq(members.id, id));
          return rows[0] ?? null;
        }),
      findByEmail: (studioId, email) =>
        run("members.findByEmail", async () => {
          const rows: Member[] = await db
            .select()
            .from(members)
            .where(and(eq(members.studioId, studioId), eq(members.email, email)));
          return rows[0] ?? null;
        }),
      insert: (member) => insertReturning("members.insert", members, member),
      update: (id, patch) =>
        updateReturning<Member>("members.update", members, eq(members.id, id), patch),
    },
    classTypes: {
      listByStudio: (studioId) =>
        run("classTypes.listByStudio", () =>
          db
            .select()
            .from(classTypes)
            .where(eq(classTypes.studioId, studioId))
            .orderBy(asc(classTypes.name)),
        ),
      getById: (id) =>
        run("classTypes.getById", async () => {
          const rows: ClassType[] = await db.select().from(classTypes).where(eq(classTypes.id, id));
          return rows[0] ?? null;
        }),
      insert: (classType) => insertReturning("classTypes.insert", classTypes, classType),
    },
    classSessions: {
      // `from` is inclusive and `to` exclusive, matching the previous adapter.
      // Timestamps are ISO-8601 UTC text, so string comparison is chronological.
      listByStudio: (studioId, range = {}) =>
        run("classSessions.listByStudio", () => {
          const filters = [eq(classSessions.studioId, studioId)];
          if (range.from) filters.push(gte(classSessions.startsAt, range.from));
          if (range.to) filters.push(lt(classSessions.startsAt, range.to));
          return db
            .select()
            .from(classSessions)
            .where(and(...filters))
            .orderBy(asc(classSessions.startsAt));
        }),
      getById: (id) =>
        run("classSessions.getById", async () => {
          const rows: ClassSession[] = await db
            .select()
            .from(classSessions)
            .where(eq(classSessions.id, id));
          return rows[0] ?? null;
        }),
      insert: (session) => insertReturning("classSessions.insert", classSessions, session),
    },
    bookings: {
      listBySessionIds: (sessionIds) =>
        run("bookings.listBySessionIds", async () => {
          if (sessionIds.length === 0) return [];
          return db.select().from(bookings).where(inArray(bookings.sessionId, sessionIds));
        }),
      listBySession: (sessionId) =>
        run("bookings.listBySession", () =>
          db.select().from(bookings).where(eq(bookings.sessionId, sessionId)),
        ),
      getById: (id) =>
        run("bookings.getById", async () => {
          const rows: Booking[] = await db.select().from(bookings).where(eq(bookings.id, id));
          return rows[0] ?? null;
        }),
      insert: (booking) => insertReturning("bookings.insert", bookings, booking),
      update: (id, patch) =>
        updateReturning<Booking>("bookings.update", bookings, eq(bookings.id, id), patch),
    },
    invoices: {
      listByStudio: (studioId) =>
        run("invoices.listByStudio", () =>
          db
            .select()
            .from(invoices)
            .where(eq(invoices.studioId, studioId))
            .orderBy(desc(invoices.issuedAt)),
        ),
      getById: (id) =>
        run("invoices.getById", async () => {
          const rows: Invoice[] = await db.select().from(invoices).where(eq(invoices.id, id));
          return rows[0] ?? null;
        }),
      countByStudio: (studioId) =>
        run("invoices.countByStudio", async () => {
          const rows = await db
            .select({ value: count() })
            .from(invoices)
            .where(eq(invoices.studioId, studioId));
          return rows[0]?.value ?? 0;
        }),
      insert: (invoice) => insertReturning("invoices.insert", invoices, invoice),
      update: (id, patch) =>
        updateReturning<Invoice>("invoices.update", invoices, eq(invoices.id, id), patch),
    },
    invoiceLineItems: {
      listByInvoice: (invoiceId) =>
        run("invoiceLineItems.listByInvoice", () =>
          db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId)),
        ),
      insertMany: (items) =>
        run("invoiceLineItems.insertMany", async () => {
          if (items.length === 0) return [];
          const inserted: InvoiceLineItem[] = await db
            .insert(invoiceLineItems)
            .values(items)
            .returning();
          return inserted;
        }),
    },
    outbox: {
      insert: (row) => insertReturning("outbox.insert", notificationOutbox, row),
      listPending: () =>
        run("outbox.listPending", () =>
          db.select().from(notificationOutbox).where(isNull(notificationOutbox.sentAt)),
        ),
      update: (id, patch) =>
        updateReturning<NotificationOutboxRow>(
          "outbox.update",
          notificationOutbox,
          eq(notificationOutbox.id, id),
          patch,
        ),
    },
  };
}
