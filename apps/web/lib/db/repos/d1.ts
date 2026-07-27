import { eq, and, inArray, desc, gte, lt, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
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

// The production repository implementation over Drizzle + Cloudflare D1.
// All queries use the Drizzle query builder and return the domain entity shape
// directly (camelCase, since schema fields map camelCase → snake_case columns).
// This replaces lib/db/repos/supabase.ts behind the existing seam.

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  return {
    studios: {
      async getFirst(): Promise<Studio | null> {
        const result = await drizzleDb.select().from(schema.studios).limit(1);
        return result.length > 0 ? (result[0] as Studio) : null;
      },
    },
    settings: {
      async getByStudioId(studioId: string): Promise<StudioSettings | null> {
        const result = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studioId, studioId));
        return result.length > 0 ? (result[0] as StudioSettings) : null;
      },
      async update(studioId: string, patch: Partial<StudioSettings>): Promise<StudioSettings> {
        const result = await drizzleDb
          .update(schema.studioSettings)
          .set(patch)
          .where(eq(schema.studioSettings.studioId, studioId))
          .returning();
        if (result.length === 0) throw new Error("Studio settings not found");
        return result[0] as StudioSettings;
      },
    },
    members: {
      async listByStudio(studioId: string): Promise<Member[]> {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studioId, studioId))
          .orderBy(schema.members.name);
        return result.map((r) => r as Member);
      },
      async getById(id: string): Promise<Member | null> {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id));
        return result.length > 0 ? (result[0] as Member) : null;
      },
      async findByEmail(studioId: string, email: string): Promise<Member | null> {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studioId, studioId), eq(schema.members.email, email)));
        return result.length > 0 ? (result[0] as Member) : null;
      },
      async insert(member: Member): Promise<Member> {
        const result = await drizzleDb.insert(schema.members).values(member).returning();
        return result[0] as Member;
      },
      async update(id: string, patch: Partial<Member>): Promise<Member> {
        const result = await drizzleDb
          .update(schema.members)
          .set(patch)
          .where(eq(schema.members.id, id))
          .returning();
        if (result.length === 0) throw new Error("Member not found");
        return result[0] as Member;
      },
    },
    classTypes: {
      async listByStudio(studioId: string): Promise<ClassType[]> {
        const result = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studioId, studioId))
          .orderBy(schema.classTypes.name);
        return result.map((r) => r as ClassType);
      },
      async getById(id: string): Promise<ClassType | null> {
        const result = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return result.length > 0 ? (result[0] as ClassType) : null;
      },
      async insert(classType: ClassType): Promise<ClassType> {
        const result = await drizzleDb.insert(schema.classTypes).values(classType).returning();
        return result[0] as ClassType;
      },
    },
    classSessions: {
      async listByStudio(studioId: string, range: SessionRange = {}): Promise<ClassSession[]> {
        const conditions = [eq(schema.classSessions.studioId, studioId)];
        if (range.from) {
          conditions.push(gte(schema.classSessions.startsAt, range.from));
        }
        if (range.to) {
          conditions.push(lt(schema.classSessions.startsAt, range.to));
        }

        const result = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.startsAt);
        return result.map((r) => r as ClassSession);
      },
      async getById(id: string): Promise<ClassSession | null> {
        const result = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return result.length > 0 ? (result[0] as ClassSession) : null;
      },
      async insert(session: ClassSession): Promise<ClassSession> {
        const result = await drizzleDb.insert(schema.classSessions).values(session).returning();
        return result[0] as ClassSession;
      },
    },
    bookings: {
      async listBySessionIds(sessionIds: string[]): Promise<Booking[]> {
        if (sessionIds.length === 0) return [];
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.sessionId, sessionIds));
        return result.map((r) => r as Booking);
      },
      async listBySession(sessionId: string): Promise<Booking[]> {
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.sessionId, sessionId));
        return result.map((r) => r as Booking);
      },
      async getById(id: string): Promise<Booking | null> {
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id));
        return result.length > 0 ? (result[0] as Booking) : null;
      },
      async insert(booking: Booking): Promise<Booking> {
        const result = await drizzleDb.insert(schema.bookings).values(booking).returning();
        return result[0] as Booking;
      },
      async update(id: string, patch: Partial<Booking>): Promise<Booking> {
        const result = await drizzleDb
          .update(schema.bookings)
          .set(patch)
          .where(eq(schema.bookings.id, id))
          .returning();
        if (result.length === 0) throw new Error("Booking not found");
        return result[0] as Booking;
      },
    },
    invoices: {
      async listByStudio(studioId: string): Promise<Invoice[]> {
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId))
          .orderBy(desc(schema.invoices.issuedAt));
        return result.map((r) => r as Invoice);
      },
      async getById(id: string): Promise<Invoice | null> {
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id));
        return result.length > 0 ? (result[0] as Invoice) : null;
      },
      async countByStudio(studioId: string): Promise<number> {
        const result = await drizzleDb
          .select({ count: sql`count(*)`.mapWith(Number) })
          .from(schema.invoices)
          .where(eq(schema.invoices.studioId, studioId));
        return result[0]?.count ?? 0;
      },
      async insert(invoice: Invoice): Promise<Invoice> {
        const result = await drizzleDb.insert(schema.invoices).values(invoice).returning();
        return result[0] as Invoice;
      },
      async update(id: string, patch: Partial<Invoice>): Promise<Invoice> {
        const result = await drizzleDb
          .update(schema.invoices)
          .set(patch)
          .where(eq(schema.invoices.id, id))
          .returning();
        if (result.length === 0) throw new Error("Invoice not found");
        return result[0] as Invoice;
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId: string): Promise<InvoiceLineItem[]> {
        const result = await drizzleDb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
        return result.map((r) => r as InvoiceLineItem);
      },
      async insertMany(items: InvoiceLineItem[]): Promise<InvoiceLineItem[]> {
        if (items.length === 0) return [];
        const result = await drizzleDb.insert(schema.invoiceLineItems).values(items).returning();
        return result.map((r) => r as InvoiceLineItem);
      },
    },
    outbox: {
      async insert(row: NotificationOutboxRow): Promise<NotificationOutboxRow> {
        const result = await drizzleDb.insert(schema.notificationOutbox).values(row).returning();
        return result[0] as NotificationOutboxRow;
      },
      async listPending(): Promise<NotificationOutboxRow[]> {
        const result = await drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sentAt));
        return result.map((r) => r as NotificationOutboxRow);
      },
      async update(
        id: string,
        patch: Partial<NotificationOutboxRow>,
      ): Promise<NotificationOutboxRow> {
        const result = await drizzleDb
          .update(schema.notificationOutbox)
          .set(patch)
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        if (result.length === 0) throw new Error("Outbox row not found");
        return result[0] as NotificationOutboxRow;
      },
    },
  };
}
