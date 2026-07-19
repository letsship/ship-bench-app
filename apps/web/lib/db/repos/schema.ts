import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// SQLite schema for D1. Column names are snake_case; Drizzle maps them
// transparently to the camelCase entity types via the schema field names.
// Booleans use integer mode; *_cents, *_bps, and capacities are integers;
// timestamps are ISO text.

export const studios = sqliteTable("studios", {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().notNull(),
  timezone: text().notNull(),
  createdAt: text("created_at").notNull(),
});

export const studioSettings = sqliteTable("studio_settings", {
  studioId: text("studio_id").primaryKey(),
  currency: text().notNull(),
  taxRateBps: integer("tax_rate_bps").notNull(),
  cancellationWindowHours: integer("cancellation_window_hours").notNull(),
  waitlistEnabled: integer("waitlist_enabled", { mode: "boolean" }).notNull(),
  notifyBookingConfirmations: integer("notify_booking_confirmations", {
    mode: "boolean",
  }).notNull(),
  notifyCancellations: integer("notify_cancellations", { mode: "boolean" }).notNull(),
  notifyWaitlistPromotions: integer("notify_waitlist_promotions", { mode: "boolean" }).notNull(),
  notifyInvoices: integer("notify_invoices", { mode: "boolean" }).notNull(),
});

export const members = sqliteTable("members", {
  id: text().primaryKey(),
  studioId: text("studio_id").notNull(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text(),
  status: text().notNull(),
  notificationsOptedOut: integer("notifications_opted_out", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const classTypes = sqliteTable("class_types", {
  id: text().primaryKey(),
  studioId: text("studio_id").notNull(),
  name: text().notNull(),
  description: text(),
  color: text().notNull(),
  defaultCapacity: integer("default_capacity").notNull(),
  defaultPriceCents: integer("default_price_cents").notNull(),
  createdAt: text("created_at").notNull(),
});

export const classSessions = sqliteTable("class_sessions", {
  id: text().primaryKey(),
  studioId: text("studio_id").notNull(),
  classTypeId: text("class_type_id").notNull(),
  instructor: text().notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  capacity: integer().notNull(),
  priceCents: integer("price_cents").notNull(),
  status: text().notNull(),
  createdAt: text("created_at").notNull(),
});

export const bookings = sqliteTable("bookings", {
  id: text().primaryKey(),
  sessionId: text("session_id").notNull(),
  memberId: text("member_id").notNull(),
  status: text().notNull(),
  bookedAt: text("booked_at").notNull(),
  cancelledAt: text("cancelled_at"),
});

export const invoices = sqliteTable("invoices", {
  id: text().primaryKey(),
  studioId: text("studio_id").notNull(),
  memberId: text("member_id").notNull(),
  number: text().notNull(),
  status: text().notNull(),
  currency: text().notNull(),
  taxRateBps: integer("tax_rate_bps").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  taxCents: integer("tax_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  issuedAt: text("issued_at").notNull(),
  dueAt: text("due_at"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").notNull(),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: text().primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  description: text().notNull(),
  quantity: integer().notNull(),
  unitAmountCents: integer("unit_amount_cents").notNull(),
  amountCents: integer("amount_cents").notNull(),
  refunded: integer({ mode: "boolean" }).notNull(),
  bookingId: text("booking_id"),
});

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text().primaryKey(),
  memberId: text("member_id").notNull(),
  kind: text().notNull(),
  payload: text().notNull(),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  providerMessageId: text("provider_message_id"),
  error: text(),
});
