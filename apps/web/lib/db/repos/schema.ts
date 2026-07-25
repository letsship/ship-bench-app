import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle ORM schema for Studiobook's SQLite database (Cloudflare D1).
// Columns are named in snake_case (matching the database) and mapped to camelCase
// domain entity fields; booleans are stored as integers (0/1) and timestamps as text (ISO-8601).
// This schema mirrors the Postgres design but adapted for SQLite constraints and types.
// Foreign key constraints are defined in the SQL migrations; this schema focuses on structure.

export const studios = sqliteTable("studios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: text("created_at").notNull(),
});

export const studioSettings = sqliteTable("studio_settings", {
  studioId: text("studio_id").primaryKey(),
  currency: text("currency").notNull().default("EUR"),
  taxRateBps: int("tax_rate_bps").notNull().default(0),
  cancellationWindowHours: int("cancellation_window_hours").notNull().default(12),
  waitlistEnabled: int("waitlist_enabled", { mode: "boolean" }).notNull().default(true),
  notifyBookingConfirmations: int("notify_booking_confirmations", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyCancellations: int("notify_cancellations", { mode: "boolean" }).notNull().default(true),
  notifyWaitlistPromotions: int("notify_waitlist_promotions", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyInvoices: int("notify_invoices", { mode: "boolean" }).notNull().default(true),
});

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  notificationsOptedOut: int("notifications_opted_out", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
});

export const classTypes = sqliteTable("class_types", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6b7280"),
  defaultCapacity: int("default_capacity").notNull().default(12),
  defaultPriceCents: int("default_price_cents").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const classSessions = sqliteTable("class_sessions", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull(),
  classTypeId: text("class_type_id").notNull(),
  instructor: text("instructor").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  capacity: int("capacity").notNull(),
  priceCents: int("price_cents").notNull().default(0),
  status: text("status").notNull().default("scheduled"),
  createdAt: text("created_at").notNull(),
});

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  memberId: text("member_id").notNull(),
  status: text("status").notNull().default("booked"),
  bookedAt: text("booked_at").notNull(),
  cancelledAt: text("cancelled_at"),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull(),
  memberId: text("member_id").notNull(),
  number: text("number").notNull(),
  status: text("status").notNull().default("draft"),
  currency: text("currency").notNull().default("EUR"),
  taxRateBps: int("tax_rate_bps").notNull().default(0),
  subtotalCents: int("subtotal_cents").notNull().default(0),
  taxCents: int("tax_cents").notNull().default(0),
  totalCents: int("total_cents").notNull().default(0),
  issuedAt: text("issued_at").notNull(),
  dueAt: text("due_at"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").notNull(),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: int("quantity").notNull().default(1),
  unitAmountCents: int("unit_amount_cents").notNull().default(0),
  amountCents: int("amount_cents").notNull().default(0),
  refunded: int("refunded", { mode: "boolean" }).notNull().default(false),
  bookingId: text("booking_id"),
});

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
});

export const schema = {
  studios,
  studioSettings,
  members,
  classTypes,
  classSessions,
  bookings,
  invoices,
  invoiceLineItems,
  notificationOutbox,
};
