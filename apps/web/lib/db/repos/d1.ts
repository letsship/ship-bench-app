import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
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
import { schema } from "./schema";
import type { Repositories } from "./types";

// The production repository implementation over Cloudflare D1 (SQLite) via
// Drizzle ORM. `createD1Repositories(db)` takes the Worker's D1 binding so the
// adapter can be constructed against any D1 instance (production Worker, wrangler
// preview, or the in-memory test shim). The Drizzle schema maps camelCase entity
// fields ↔ snake_case columns, so inserts/updates accept the entity directly and
// selects return camelCase rows — no manual key mapping. Behaviour mirrors the
// previous Supabase adapter exactly: same ordering, same inclusive-from /
// exclusive-to session range, same `sent_at IS NULL` pending filter, and the same
// empty-array short-circuits for `bookings.listBySessionIds` and
// `invoiceLineItems.insertMany`. Services set ids + timestamps app-side, so
// inserts write every column.

type Db = DrizzleD1Database<typeof schema>;

type Table = keyof typeof schema;

function notFound(label: string): never {
  throw new Error(`${label} not found`);
}

export function createD1Repositories(d1: D1Database): Repositories {
  const db: Db = drizzle(d1, { schema });

  async function insertReturning<T>(table: Table, row: T): Promise<T> {
    const inserted = await db.insert(schema[table]).values(row as never).returning();
    if (inserted.length === 0) notFound(table);
    return inserted[0] as unknown as T;
  }

  async function updateReturning<T>(
    table: Table,
    column: ReturnType<typeof eq>,
    patch: Partial<T>,
    label: string,
  ): Promise<T> {
    const updated = await db
      .update(schema[table])
      .set(patch as never)
      .where(column)
      .returning();
    if (updated.length === 0) notFound(label);
    return updated[0] as unknown as T;
  }

  return {
    studios: {
      async getFirst(): Promise<Studio | null> {
        const rows = await db.select().from(schema.studios).limit(1);
        return rows[0] ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId): Promise<StudioSettings | null> {
        const rows = await db
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId))
          .limit(1);
        return rows[0] ?? null;
      },
      async update(studioId, patch): Promise<StudioSettings> {
        return updateReturning<StudioSettings>(
          "studioSettings",
          eq(schema.studioSettings.studioId, studioId),
          patch,
          "Studio settings",
        );
      },
    },
    members: {
      async listByStudio(studioId): Promise<Member[]> {
        return db
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(asc(schema.members.name));
      },
      async getById(id): Promise<Member | null> {
        const rows = await db
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async findByEmail(studioId, email): Promise<Member | null> {
        const rows = await db
          .select()
          .from(schema.members)
          .where(
            and(
              eq(schema.members.studioId, studioId),
              eq(schema.members.email, email),
            ),
          )
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(member): Promise<Member> {
        return insertReturning<Member>("members", member);
      },
      async update(id, patch): Promise<Member> {
        return updateReturning<Member>(
          "members",
          eq(schema.members.id, id),
          patch,
          "Member",
        );
      },
    },
    classTypes: {
      async listByStudio(studioId): Promise<ClassType[]> {
        return db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(asc(schema.classTypes.name));
      },
      async getById(id): Promise<ClassType | null> {
        const rows = await db
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(classType): Promise<ClassType> {
        return insertReturning<ClassType>("classTypes", classType);
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}): Promise<ClassSession[]> {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return db
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(asc(schema.classSessions.startsAt));
      },
      async getById(id): Promise<ClassSession | null> {
        const rows = await db
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(session): Promise<ClassSession> {
        return insertReturning<ClassSession>("classSessions", session);
      },
    },
    bookings: {
      async listBySessionIds(sessionIds): Promise<Booking[]> {
        if (sessionIds.length === 0) return [];
        return db
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId): Promise<Booking[]> {
        return db
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id): Promise<Booking | null> {
        const rows = await db
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async insert(booking): Promise<Booking> {
        return insertReturning<Booking>("bookings", booking);
      },
      async update(id, patch): Promise<Booking> {
        return updateReturning<Booking>(
          "bookings",
          eq(schema.bookings.id, id),
          patch,
          "Booking",
        );
      },
    },
    invoices: {
      async listByStudio(studioId): Promise<Invoice[]> {
        return db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      async getById(id): Promise<Invoice | null> {
        const rows = await db
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      async countByStudio(studioId): Promise<number> {
        const rows = await db
          .select({ value: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return Number(rows[0]?.value ?? 0);
      },
      async insert(invoice): Promise<Invoice> {
        return insertReturning<Invoice>("invoices", invoice);
      },
      async update(id, patch): Promise<Invoice> {
        return updateReturning<Invoice>(
          "invoices",
          eq(schema.invoices.id, id),
          patch,
          "Invoice",
        );
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId): Promise<InvoiceLineItem[]> {
        return db
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items): Promise<InvoiceLineItem[]> {
        if (items.length === 0) return [];
        return db.insert(schema.invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      async insert(row): Promise<NotificationOutboxRow> {
        return insertReturning<NotificationOutboxRow>("notificationOutbox", row);
      },
      async listPending(): Promise<NotificationOutboxRow[]> {
        return db
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch): Promise<NotificationOutboxRow> {
        return updateReturning<NotificationOutboxRow>(
          "notificationOutbox",
          eq(schema.notificationOutbox.id, id),
          patch,
          "Outbox row",
        );
      },
    },
  };
}
