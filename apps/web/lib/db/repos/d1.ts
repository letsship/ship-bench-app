import { drizzle, type AnyD1Database } from "drizzle-orm/d1";
import { eq, and, gte, lt, isNull, desc, inArray } from "drizzle-orm";
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
import * as schema from "./schema";

// Production repository implementation over Cloudflare D1 via Drizzle ORM.
// Maps rows from snake_case D1 columns to camelCase entity types transparently
// via the schema field names. Implements the same semantics as the Supabase version.

export function createD1Repositories(db: AnyD1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  return {
    studios: {
      async getFirst(): Promise<Studio | null> {
        const rows = await drizzleDb.select().from(schema.studios).limit(1);
        return rows[0] ?? null;
      },
    },
    settings: {
      async getByStudioId(studioId): Promise<StudioSettings | null> {
        const rows = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return rows[0] ?? null;
      },
      async update(studioId, patch): Promise<StudioSettings> {
        const rows = await drizzleDb
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        return rows[0];
      },
    },
    members: {
      async listByStudio(studioId): Promise<Member[]> {
        return drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name);
      },
      async getById(id): Promise<Member | null> {
        const rows = await drizzleDb.select().from(schema.members).where(eq(schema.members.id, id));
        return rows[0] ?? null;
      },
      async findByEmail(studioId, email): Promise<Member | null> {
        const rows = await drizzleDb
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return rows[0] ?? null;
      },
      async insert(member): Promise<Member> {
        const rows = await drizzleDb.insert(schema.members).values(member).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Member> {
        const rows = await drizzleDb
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        return rows[0];
      },
    },
    classTypes: {
      async listByStudio(studioId): Promise<ClassType[]> {
        return drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name);
      },
      async getById(id): Promise<ClassType | null> {
        const rows = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return rows[0] ?? null;
      },
      async insert(classType): Promise<ClassType> {
        const rows = await drizzleDb.insert(schema.classTypes).values(classType).returning();
        return rows[0];
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}): Promise<ClassSession[]> {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) conditions.push(gte(schema.classSessions.startsAt, range.from));
        if (range.to) conditions.push(lt(schema.classSessions.startsAt, range.to));
        return drizzleDb
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.startsAt);
      },
      async getById(id): Promise<ClassSession | null> {
        const rows = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return rows[0] ?? null;
      },
      async insert(session): Promise<ClassSession> {
        const rows = await drizzleDb.insert(schema.classSessions).values(session).returning();
        return rows[0];
      },
    },
    bookings: {
      async listBySessionIds(sessionIds): Promise<Booking[]> {
        if (sessionIds.length === 0) return [];
        return drizzleDb
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
      },
      async listBySession(sessionId): Promise<Booking[]> {
        return drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
      },
      async getById(id): Promise<Booking | null> {
        const rows = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id));
        return rows[0] ?? null;
      },
      async insert(booking): Promise<Booking> {
        const rows = await drizzleDb.insert(schema.bookings).values(booking).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Booking> {
        const rows = await drizzleDb
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        return rows[0];
      },
    },
    invoices: {
      async listByStudio(studioId): Promise<Invoice[]> {
        return drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
      },
      async getById(id): Promise<Invoice | null> {
        const rows = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id));
        return rows[0] ?? null;
      },
      async countByStudio(studioId): Promise<number> {
        return drizzleDb.$count(schema.invoices, eq(schema.invoices.studioId, studioId));
      },
      async insert(invoice): Promise<Invoice> {
        const rows = await drizzleDb.insert(schema.invoices).values(invoice).returning();
        return rows[0];
      },
      async update(id, patch): Promise<Invoice> {
        const rows = await drizzleDb
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        return rows[0];
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId): Promise<InvoiceLineItem[]> {
        return drizzleDb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
      },
      async insertMany(items): Promise<InvoiceLineItem[]> {
        if (items.length === 0) return [];
        return drizzleDb.insert(schema.invoiceLineItems).values(items).returning();
      },
    },
    outbox: {
      async insert(row): Promise<NotificationOutboxRow> {
        const rows = await drizzleDb.insert(schema.notificationOutbox).values(row).returning();
        return rows[0];
      },
      async listPending(): Promise<NotificationOutboxRow[]> {
        return drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
      },
      async update(id, patch): Promise<NotificationOutboxRow> {
        const rows = await drizzleDb
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        return rows[0];
      },
    },
  };
}
