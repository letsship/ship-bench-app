import type { D1Database } from "@cloudflare/workers-types";
import { and, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
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
import { schema } from "./schema";
import type { Repositories, SessionRange } from "./types";

// Production repository implementation over Cloudflare D1 with Drizzle ORM.
// The adapter takes the D1 database binding as an argument and implements the
// full Repositories interface with the same semantics as the Supabase implementation.
// Drizzle returns snake_case columns; we map them to camelCase entity types.

function mapRow<T>(row: Record<string, unknown>): T {
  return toCamelRow<T>(row);
}

function mapRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => mapRow<T>(row));
}

export function createD1Repositories(db: D1Database): Repositories {
  const drizzleDb = drizzle(db, { schema });

  return {
    studios: {
      async getFirst() {
        const result = await drizzleDb.select().from(schema.studios).limit(1);
        return result[0] ? mapRow<Studio>(result[0] as Record<string, unknown>) : null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.studioSettings)
          .where(eq(schema.studioSettings.studio_id, studioId));
        return result[0] ? mapRow<StudioSettings>(result[0] as Record<string, unknown>) : null;
      },
      async update(studioId, patch) {
        const toUpdate = Object.fromEntries(
          Object.entries(patch).map(([key, value]) => {
            if (key === "studioId") return ["studio_id", value];
            if (key === "waitlistEnabled") return ["waitlist_enabled", value];
            if (key === "notifyBookingConfirmations")
              return ["notify_booking_confirmations", value];
            if (key === "notifyCancellations") return ["notify_cancellations", value];
            if (key === "notifyWaitlistPromotions") return ["notify_waitlist_promotions", value];
            if (key === "notifyInvoices") return ["notify_invoices", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .update(schema.studioSettings)
          .set(toUpdate as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .where(eq(schema.studioSettings.studio_id, studioId))
          .returning();
        if (!result[0]) throw new Error("Studio settings not found");
        return mapRow<StudioSettings>(result[0] as Record<string, unknown>);
      },
    },
    members: {
      async listByStudio(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.studio_id, studioId))
          .orderBy(schema.members.name);
        return mapRows<Member>(result as Record<string, unknown>[]);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(eq(schema.members.id, id));
        return result[0] ? mapRow<Member>(result[0] as Record<string, unknown>) : null;
      },
      async findByEmail(studioId, email) {
        const result = await drizzleDb
          .select()
          .from(schema.members)
          .where(and(eq(schema.members.studio_id, studioId), eq(schema.members.email, email)));
        return result[0] ? mapRow<Member>(result[0] as Record<string, unknown>) : null;
      },
      async insert(member) {
        const toInsert = Object.fromEntries(
          Object.entries(member).map(([key, value]) => {
            if (key === "studioId") return ["studio_id", value];
            if (key === "notificationsOptedOut") return ["notifications_opted_out", value];
            if (key === "createdAt") return ["created_at", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .insert(schema.members)
          .values(toInsert as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .returning();
        return mapRow<Member>(result[0] as Record<string, unknown>);
      },
      async update(id, patch) {
        const toUpdate = Object.fromEntries(
          Object.entries(patch).map(([key, value]) => {
            if (key === "studioId") return ["studio_id", value];
            if (key === "notificationsOptedOut") return ["notifications_opted_out", value];
            if (key === "createdAt") return ["created_at", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .update(schema.members)
          .set(toUpdate as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .where(eq(schema.members.id, id))
          .returning();
        if (!result[0]) throw new Error("Member not found");
        return mapRow<Member>(result[0] as Record<string, unknown>);
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.studio_id, studioId))
          .orderBy(schema.classTypes.name);
        return mapRows<ClassType>(result as Record<string, unknown>[]);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.classTypes)
          .where(eq(schema.classTypes.id, id));
        return result[0] ? mapRow<ClassType>(result[0] as Record<string, unknown>) : null;
      },
      async insert(classType) {
        const toInsert = Object.fromEntries(
          Object.entries(classType).map(([key, value]) => {
            if (key === "studioId") return ["studio_id", value];
            if (key === "defaultCapacity") return ["default_capacity", value];
            if (key === "defaultPriceCents") return ["default_price_cents", value];
            if (key === "createdAt") return ["created_at", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .insert(schema.classTypes)
          .values(toInsert as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .returning();
        return mapRow<ClassType>(result[0] as Record<string, unknown>);
      },
    },
    classSessions: {
      async listByStudio(studioId, range?: SessionRange) {
        const conditions = [eq(schema.classSessions.studio_id, studioId)];
        if (range?.from) conditions.push(gte(schema.classSessions.starts_at, range.from));
        if (range?.to) conditions.push(lt(schema.classSessions.starts_at, range.to));

        const result = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(and(...conditions))
          .orderBy(schema.classSessions.starts_at);
        return mapRows<ClassSession>(result as Record<string, unknown>[]);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, id));
        return result[0] ? mapRow<ClassSession>(result[0] as Record<string, unknown>) : null;
      },
      async insert(session) {
        const toInsert = Object.fromEntries(
          Object.entries(session).map(([key, value]) => {
            if (key === "studioId") return ["studio_id", value];
            if (key === "classTypeId") return ["class_type_id", value];
            if (key === "startsAt") return ["starts_at", value];
            if (key === "endsAt") return ["ends_at", value];
            if (key === "priceCents") return ["price_cents", value];
            if (key === "createdAt") return ["created_at", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .insert(schema.classSessions)
          .values(toInsert as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .returning();
        return mapRow<ClassSession>(result[0] as Record<string, unknown>);
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        if (sessionIds.length === 0) return [];
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(inArray(schema.bookings.session_id, sessionIds));
        return mapRows<Booking>(result as Record<string, unknown>[]);
      },
      async listBySession(sessionId) {
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.session_id, sessionId));
        return mapRows<Booking>(result as Record<string, unknown>[]);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.id, id));
        return result[0] ? mapRow<Booking>(result[0] as Record<string, unknown>) : null;
      },
      async insert(booking) {
        const toInsert = Object.fromEntries(
          Object.entries(booking).map(([key, value]) => {
            if (key === "sessionId") return ["session_id", value];
            if (key === "memberId") return ["member_id", value];
            if (key === "bookedAt") return ["booked_at", value];
            if (key === "cancelledAt") return ["cancelled_at", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .insert(schema.bookings)
          .values(toInsert as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .returning();
        return mapRow<Booking>(result[0] as Record<string, unknown>);
      },
      async update(id, patch) {
        const toUpdate = Object.fromEntries(
          Object.entries(patch).map(([key, value]) => {
            if (key === "sessionId") return ["session_id", value];
            if (key === "memberId") return ["member_id", value];
            if (key === "bookedAt") return ["booked_at", value];
            if (key === "cancelledAt") return ["cancelled_at", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .update(schema.bookings)
          .set(toUpdate as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .where(eq(schema.bookings.id, id))
          .returning();
        if (!result[0]) throw new Error("Booking not found");
        return mapRow<Booking>(result[0] as Record<string, unknown>);
      },
    },
    invoices: {
      async listByStudio(studioId) {
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.studio_id, studioId))
          .orderBy(desc(schema.invoices.issued_at));
        return mapRows<Invoice>(result as Record<string, unknown>[]);
      },
      async getById(id) {
        const result = await drizzleDb
          .select()
          .from(schema.invoices)
          .where(eq(schema.invoices.id, id));
        return result[0] ? mapRow<Invoice>(result[0] as Record<string, unknown>) : null;
      },
      async countByStudio(studioId) {
        const result = await drizzleDb
          .select({ count: count() })
          .from(schema.invoices)
          .where(eq(schema.invoices.studio_id, studioId));
        return result[0]?.count ?? 0;
      },
      async insert(invoice) {
        const toInsert = Object.fromEntries(
          Object.entries(invoice).map(([key, value]) => {
            if (key === "studioId") return ["studio_id", value];
            if (key === "memberId") return ["member_id", value];
            if (key === "taxRateBps") return ["tax_rate_bps", value];
            if (key === "subtotalCents") return ["subtotal_cents", value];
            if (key === "taxCents") return ["tax_cents", value];
            if (key === "totalCents") return ["total_cents", value];
            if (key === "issuedAt") return ["issued_at", value];
            if (key === "dueAt") return ["due_at", value];
            if (key === "paidAt") return ["paid_at", value];
            if (key === "createdAt") return ["created_at", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .insert(schema.invoices)
          .values(toInsert as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .returning();
        return mapRow<Invoice>(result[0] as Record<string, unknown>);
      },
      async update(id, patch) {
        const toUpdate = Object.fromEntries(
          Object.entries(patch).map(([key, value]) => {
            if (key === "studioId") return ["studio_id", value];
            if (key === "memberId") return ["member_id", value];
            if (key === "taxRateBps") return ["tax_rate_bps", value];
            if (key === "subtotalCents") return ["subtotal_cents", value];
            if (key === "taxCents") return ["tax_cents", value];
            if (key === "totalCents") return ["total_cents", value];
            if (key === "issuedAt") return ["issued_at", value];
            if (key === "dueAt") return ["due_at", value];
            if (key === "paidAt") return ["paid_at", value];
            if (key === "createdAt") return ["created_at", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .update(schema.invoices)
          .set(toUpdate as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .where(eq(schema.invoices.id, id))
          .returning();
        if (!result[0]) throw new Error("Invoice not found");
        return mapRow<Invoice>(result[0] as Record<string, unknown>);
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        const result = await drizzleDb
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoice_id, invoiceId));
        return mapRows<InvoiceLineItem>(result as Record<string, unknown>[]);
      },
      async insertMany(items) {
        if (items.length === 0) return [];
        const toInsert = items.map((item) =>
          Object.fromEntries(
            Object.entries(item).map(([key, value]) => {
              if (key === "invoiceId") return ["invoice_id", value];
              if (key === "unitAmountCents") return ["unit_amount_cents", value];
              if (key === "amountCents") return ["amount_cents", value];
              if (key === "bookingId") return ["booking_id", value];
              return [key, value];
            }),
          ),
        );
        const result = await drizzleDb
          .insert(schema.invoiceLineItems)
          .values(toInsert as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .returning();
        return mapRows<InvoiceLineItem>(result as Record<string, unknown>[]);
      },
    },
    outbox: {
      async insert(row) {
        const toInsert = Object.fromEntries(
          Object.entries(row).map(([key, value]) => {
            if (key === "memberId") return ["member_id", value];
            if (key === "createdAt") return ["created_at", value];
            if (key === "sentAt") return ["sent_at", value];
            if (key === "providerMessageId") return ["provider_message_id", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .insert(schema.notificationOutbox)
          .values(toInsert as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .returning();
        return mapRow<NotificationOutboxRow>(result[0] as Record<string, unknown>);
      },
      async listPending() {
        const result = await drizzleDb
          .select()
          .from(schema.notificationOutbox)
          .where(isNull(schema.notificationOutbox.sent_at));
        return mapRows<NotificationOutboxRow>(result as Record<string, unknown>[]);
      },
      async update(id, patch) {
        const toUpdate = Object.fromEntries(
          Object.entries(patch).map(([key, value]) => {
            if (key === "memberId") return ["member_id", value];
            if (key === "createdAt") return ["created_at", value];
            if (key === "sentAt") return ["sent_at", value];
            if (key === "providerMessageId") return ["provider_message_id", value];
            return [key, value];
          }),
        );
        const result = await drizzleDb
          .update(schema.notificationOutbox)
          .set(toUpdate as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .where(eq(schema.notificationOutbox.id, id))
          .returning();
        if (!result[0]) throw new Error("Outbox row not found");
        return mapRow<NotificationOutboxRow>(result[0] as Record<string, unknown>);
      },
    },
  };
}
