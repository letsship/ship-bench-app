import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// All timestamps are ISO 8601 strings in UTC (e.g. "2026-03-14T09:00:00.000Z").
// Wall-clock/day/month bucketing is derived in a studio's timezone by the pure
// helpers in lib/domain/dates.ts — never by reading these columns directly.
const isoTimestamp = (name: string) => text(name);
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const studios = sqliteTable("studios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  // IANA timezone, e.g. "Europe/Amsterdam". Governs all day/month bucketing.
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: createdAt(),
});

export const studioSettings = sqliteTable("studio_settings", {
  studioId: text("studio_id")
    .primaryKey()
    .references(() => studios.id),
  currency: text("currency").notNull().default("EUR"),
  // Sales tax rate in basis points (e.g. 2100 = 21%).
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  // Hours before a session starts within which a cancellation is no longer
  // eligible for a refund / credit.
  cancellationWindowHours: integer("cancellation_window_hours").notNull().default(12),
  waitlistEnabled: integer("waitlist_enabled", { mode: "boolean" }).notNull().default(true),
  // Notification opt-outs — when true, the outbox dispatcher skips that kind.
  notifyBookingConfirmations: integer("notify_booking_confirmations", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyCancellations: integer("notify_cancellations", { mode: "boolean" }).notNull().default(true),
  notifyWaitlistPromotions: integer("notify_waitlist_promotions", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyInvoices: integer("notify_invoices", { mode: "boolean" }).notNull().default(true),
});

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studios.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    // "active" | "paused" | "cancelled"
    status: text("status").notNull().default("active"),
    // Per-member override of the studio-wide notification opt-in.
    notificationsOptedOut: integer("notifications_opted_out", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("members_studio_email_idx").on(table.studioId, table.email)],
);

export const classTypes = sqliteTable("class_types", {
  id: text("id").primaryKey(),
  studioId: text("studio_id")
    .notNull()
    .references(() => studios.id),
  name: text("name").notNull(),
  description: text("description"),
  // Hex color used by the schedule UI.
  color: text("color").notNull().default("#6b7280"),
  defaultCapacity: integer("default_capacity").notNull().default(12),
  defaultPriceCents: integer("default_price_cents").notNull().default(0),
  createdAt: createdAt(),
});

export const classSessions = sqliteTable(
  "class_sessions",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studios.id),
    classTypeId: text("class_type_id")
      .notNull()
      .references(() => classTypes.id),
    instructor: text("instructor").notNull(),
    startsAt: isoTimestamp("starts_at").notNull(),
    endsAt: isoTimestamp("ends_at").notNull(),
    capacity: integer("capacity").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    // "scheduled" | "cancelled"
    status: text("status").notNull().default("scheduled"),
    createdAt: createdAt(),
  },
  (table) => [index("class_sessions_starts_at_idx").on(table.startsAt)],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => classSessions.id),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    // "booked" | "waitlisted" | "attended" | "no_show" | "cancelled"
    status: text("status").notNull().default("booked"),
    bookedAt: createdAt(),
    cancelledAt: isoTimestamp("cancelled_at"),
  },
  (table) => [
    index("bookings_session_idx").on(table.sessionId),
    index("bookings_member_idx").on(table.memberId),
  ],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studios.id),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    number: text("number").notNull(),
    // "draft" | "open" | "paid" | "void" | "refunded"
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull().default("EUR"),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    issuedAt: isoTimestamp("issued_at").notNull(),
    dueAt: isoTimestamp("due_at"),
    paidAt: isoTimestamp("paid_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("invoices_number_idx").on(table.studioId, table.number),
    index("invoices_member_idx").on(table.memberId),
  ],
);

export const invoiceLineItems = sqliteTable(
  "invoice_line_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitAmountCents: integer("unit_amount_cents").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    refunded: integer("refunded", { mode: "boolean" }).notNull().default(false),
    bookingId: text("booking_id").references(() => bookings.id),
  },
  (table) => [index("invoice_line_items_invoice_idx").on(table.invoiceId)],
);

export const notificationOutbox = sqliteTable(
  "notification_outbox",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
    // NotificationKind, see lib/notifications/types.ts
    kind: text("kind").notNull(),
    // JSON-encoded payload passed to the provider adapter.
    payload: text("payload").notNull(),
    createdAt: createdAt(),
    sentAt: isoTimestamp("sent_at"),
    // Provider message id once delivered, or an error string on failure.
    providerMessageId: text("provider_message_id"),
    error: text("error"),
  },
  (table) => [index("notification_outbox_sent_idx").on(table.sentAt)],
);

export type Studio = typeof studios.$inferSelect;
export type StudioSettings = typeof studioSettings.$inferSelect;
export type Member = typeof members.$inferSelect;
export type ClassType = typeof classTypes.$inferSelect;
export type ClassSession = typeof classSessions.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NotificationOutboxRow = typeof notificationOutbox.$inferSelect;

export type NewStudio = typeof studios.$inferInsert;
export type NewMember = typeof members.$inferInsert;
export type NewClassType = typeof classTypes.$inferInsert;
export type NewClassSession = typeof classSessions.$inferInsert;
export type NewBooking = typeof bookings.$inferInsert;
export type NewInvoice = typeof invoices.$inferInsert;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type NewNotificationOutboxRow = typeof notificationOutbox.$inferInsert;
