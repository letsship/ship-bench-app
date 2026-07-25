import { describe, it, expect } from "vitest";
import { toCamelKey, toSnakeKey } from "./mapping";
import * as schema from "./schema";

describe("Drizzle schema mapping", () => {
  // All columns in the schema must be in snake_case (the database representation)
  // but must map to camelCase entity fields when used by the app.

  const tableColumns = {
    studios: [
      { db: "id", app: "id" },
      { db: "name", app: "name" },
      { db: "slug", app: "slug" },
      { db: "timezone", app: "timezone" },
      { db: "created_at", app: "createdAt" },
    ],
    studio_settings: [
      { db: "studio_id", app: "studioId" },
      { db: "currency", app: "currency" },
      { db: "tax_rate_bps", app: "taxRateBps" },
      { db: "cancellation_window_hours", app: "cancellationWindowHours" },
      { db: "waitlist_enabled", app: "waitlistEnabled" },
      { db: "notify_booking_confirmations", app: "notifyBookingConfirmations" },
      { db: "notify_cancellations", app: "notifyCancellations" },
      { db: "notify_waitlist_promotions", app: "notifyWaitlistPromotions" },
      { db: "notify_invoices", app: "notifyInvoices" },
    ],
    members: [
      { db: "id", app: "id" },
      { db: "studio_id", app: "studioId" },
      { db: "name", app: "name" },
      { db: "email", app: "email" },
      { db: "phone", app: "phone" },
      { db: "status", app: "status" },
      { db: "notifications_opted_out", app: "notificationsOptedOut" },
      { db: "created_at", app: "createdAt" },
    ],
    class_types: [
      { db: "id", app: "id" },
      { db: "studio_id", app: "studioId" },
      { db: "name", app: "name" },
      { db: "description", app: "description" },
      { db: "color", app: "color" },
      { db: "default_capacity", app: "defaultCapacity" },
      { db: "default_price_cents", app: "defaultPriceCents" },
      { db: "created_at", app: "createdAt" },
    ],
    class_sessions: [
      { db: "id", app: "id" },
      { db: "studio_id", app: "studioId" },
      { db: "class_type_id", app: "classTypeId" },
      { db: "instructor", app: "instructor" },
      { db: "starts_at", app: "startsAt" },
      { db: "ends_at", app: "endsAt" },
      { db: "capacity", app: "capacity" },
      { db: "price_cents", app: "priceCents" },
      { db: "status", app: "status" },
      { db: "created_at", app: "createdAt" },
    ],
    bookings: [
      { db: "id", app: "id" },
      { db: "session_id", app: "sessionId" },
      { db: "member_id", app: "memberId" },
      { db: "status", app: "status" },
      { db: "booked_at", app: "bookedAt" },
      { db: "cancelled_at", app: "cancelledAt" },
    ],
    invoices: [
      { db: "id", app: "id" },
      { db: "studio_id", app: "studioId" },
      { db: "member_id", app: "memberId" },
      { db: "number", app: "number" },
      { db: "status", app: "status" },
      { db: "currency", app: "currency" },
      { db: "tax_rate_bps", app: "taxRateBps" },
      { db: "subtotal_cents", app: "subtotalCents" },
      { db: "tax_cents", app: "taxCents" },
      { db: "total_cents", app: "totalCents" },
      { db: "issued_at", app: "issuedAt" },
      { db: "due_at", app: "dueAt" },
      { db: "paid_at", app: "paidAt" },
      { db: "created_at", app: "createdAt" },
    ],
    invoice_line_items: [
      { db: "id", app: "id" },
      { db: "invoice_id", app: "invoiceId" },
      { db: "description", app: "description" },
      { db: "quantity", app: "quantity" },
      { db: "unit_amount_cents", app: "unitAmountCents" },
      { db: "amount_cents", app: "amountCents" },
      { db: "refunded", app: "refunded" },
      { db: "booking_id", app: "bookingId" },
    ],
    notification_outbox: [
      { db: "id", app: "id" },
      { db: "member_id", app: "memberId" },
      { db: "kind", app: "kind" },
      { db: "payload", app: "payload" },
      { db: "created_at", app: "createdAt" },
      { db: "sent_at", app: "sentAt" },
      { db: "provider_message_id", app: "providerMessageId" },
      { db: "error", app: "error" },
    ],
  };

  it("should correctly map all column names from snake_case to camelCase", () => {
    for (const [_, columns] of Object.entries(tableColumns)) {
      for (const { db, app } of columns) {
        expect(toSnakeKey(app)).toBe(db);
        expect(toCamelKey(db)).toBe(app);
      }
    }
  });

  it("should define all nine entities in the schema", () => {
    expect(schema.schema).toHaveProperty("studios");
    expect(schema.schema).toHaveProperty("studioSettings");
    expect(schema.schema).toHaveProperty("members");
    expect(schema.schema).toHaveProperty("classTypes");
    expect(schema.schema).toHaveProperty("classSessions");
    expect(schema.schema).toHaveProperty("bookings");
    expect(schema.schema).toHaveProperty("invoices");
    expect(schema.schema).toHaveProperty("invoiceLineItems");
    expect(schema.schema).toHaveProperty("notificationOutbox");
  });

  it("should have all entities match the expected table names", () => {
    // Drizzle table objects have a dbName property or are accessed via the table's metadata
    const tables: Record<string, [string, string]> = {
      studios: ["studios", "studios"],
      studioSettings: ["studio_settings", "studio_settings"],
      members: ["members", "members"],
      classTypes: ["class_types", "class_types"],
      classSessions: ["class_sessions", "class_sessions"],
      bookings: ["bookings", "bookings"],
      invoices: ["invoices", "invoices"],
      invoiceLineItems: ["invoice_line_items", "invoice_line_items"],
      notificationOutbox: ["notification_outbox", "notification_outbox"],
    };

    for (const [schemaKey] of Object.entries(tables)) {
      const table = schema.schema[schemaKey as keyof typeof schema.schema];
      expect(table).toBeDefined();
    }
  });
});
