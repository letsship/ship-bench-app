import { drizzle } from "drizzle-orm/d1";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import * as schema from "../schema";
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
import type { Repositories, SessionRange } from "./types";

// The production repository implementation over Cloudflare D1 (the Worker's
// `DB` binding) using Drizzle ORM. `createD1Repositories(db)` accepts the D1
// binding so the adapter can be constructed against any D1 instance (the
// Worker in production, or an in-process Miniflare D1 in the conformance
// test). Drizzle maps the snake_case columns straight onto the camelCase
// entity keys (see `lib/db/schema.ts`), so rows are domain rows — no
// snake/camel helper is needed here, unlike the old Supabase path.
//
// Semantics mirror the deleted `supabase.ts` exactly: members/classTypes
// ordered by name; sessions ordered by `starts_at` with inclusive-`from` /
// exclusive-`to` range; invoices ordered by `issued_at` desc; `countByStudio`
// for invoices; empty-input short-circuits for `bookings.listBySessionIds` and
// `invoiceLineItems.insertMany`; `outbox.listPending` filters `sent_at IS
// NULL`; inserts/updates use RETURNING (supported by D1).

type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createD1Repositories(d1: D1Database): Repositories {
  const db: Db = drizzle(d1, { schema });

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
          .where(eq(schema.studioSettings.studioId, studioId));
        return rows[0] ?? null;
      },
      async update(studioId, patch): Promise<StudioSettings> {
        const rows = await db
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        if (rows.length === 0) throw new Error("Studio settings not found");
        return rows[0];
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
        const rows = await db.select().from(schema.members).where(eq(schema.members.id, id));
        return rows[0] ?? null;
      },
      async findByEmail(studioId, email): Promise<Member | null> {
        const rows = await db
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return rows[0] ?? null;
      },
      async insert(member): Promise<Member> {
        const rows = await db.insert(schema.members).values(member).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Member> {
        const rows = await db
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        if (rows.length === 0) throw new Error("Member not found");
        return rows[0];
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
        const rows = await db.select().from(schema.classTypes).where(eq(schema.classTypes.id, id));
        return rows[0] ?? null;
      },
      async insert(classType): Promise<ClassType> {
        const rows = await db.insert(schema.classTypes).values(classType).returning();
        return rows[0];
      },
    },

    classSessions: {
      async listByStudio(studioId, range: SessionRange = {}): Promise<ClassSession[]> {
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
          .where(eq(schema.classSessions.id, id));
        return rows[0] ?? null;
      },
      async insert(session): Promise<ClassSession> {
        const rows = await db.insert(schema.classSessions).values(session).returning();
        return rows[0];
      },
    },

    bookings: {
      async listBySessionIds(sessionIds): Promise<Booking[]> {
        if (sessionIds.length === 0) return [];
        return db.select().from(schema.bookings).where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId): Promise<Booking[]> {
        return db.select().from(schema.bookings).where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id): Promise<Booking | null> {
        const rows = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
        return rows[0] ?? null;
      },
      async insert(booking): Promise<Booking> {
        const rows = await db.insert(schema.bookings).values(booking).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Booking> {
        const rows = await db
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        if (rows.length === 0) throw new Error("Booking not found");
        return rows[0];
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
        const rows = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
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
        const rows = await db.insert(schema.invoices).values(invoice).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Invoice> {
        const rows = await db
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        if (rows.length === 0) throw new Error("Invoice not found");
        return rows[0];
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
        const rows = await db.insert(schema.notificationOutbox).values(row).returning();
        return rows[0];
      },
      async listPending(): Promise<NotificationOutboxRow[]> {
        return db
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch): Promise<NotificationOutboxRow> {
        const rows = await db
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        if (rows.length === 0) throw new Error("Outbox row not found");
        return rows[0];
      },
    },
  };
}

