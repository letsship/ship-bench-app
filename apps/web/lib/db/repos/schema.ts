import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle sqlite-core schema for Studiobook.
// Columns are snake_case matching the Postgres schema; types map as:
// - text for ids, timestamps, and text fields
// - integer for numeric fields and booleans (mode: 'boolean' for SQLite conversion)
// This lets Drizzle round-trip the camelCase entity types directly.

export const studios = sqliteTable("studios", {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().notNull(),
  timezone: text().notNull().default("UTC"),
  created_at: text().notNull(),
});

export const studioSettings = sqliteTable("studio_settings", {
  studio_id: text()
    .primaryKey()
    .references(() => studios.id, { onDelete: "cascade" }),
  currency: text().notNull().default("EUR"),
  tax_rate_bps: integer().notNull().default(0),
  cancellation_window_hours: integer().notNull().default(12),
  waitlist_enabled: integer({ mode: "boolean" }).notNull().default(true),
  notify_booking_confirmations: integer({ mode: "boolean" }).notNull().default(true),
  notify_cancellations: integer({ mode: "boolean" }).notNull().default(true),
  notify_waitlist_promotions: integer({ mode: "boolean" }).notNull().default(true),
  notify_invoices: integer({ mode: "boolean" }).notNull().default(true),
});

export const members = sqliteTable("members", {
  id: text().primaryKey(),
  studio_id: text()
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  name: text().notNull(),
  email: text().notNull(),
  phone: text(),
  status: text().notNull().default("active"),
  notifications_opted_out: integer({ mode: "boolean" }).notNull().default(false),
  created_at: text().notNull(),
});

export const classTypes = sqliteTable("class_types", {
  id: text().primaryKey(),
  studio_id: text()
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  color: text().notNull().default("#6b7280"),
  default_capacity: integer().notNull().default(12),
  default_price_cents: integer().notNull().default(0),
  created_at: text().notNull(),
});

export const classSessions = sqliteTable("class_sessions", {
  id: text().primaryKey(),
  studio_id: text()
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  class_type_id: text()
    .notNull()
    .references(() => classTypes.id),
  instructor: text().notNull(),
  starts_at: text().notNull(),
  ends_at: text().notNull(),
  capacity: integer().notNull(),
  price_cents: integer().notNull().default(0),
  status: text().notNull().default("scheduled"),
  created_at: text().notNull(),
});

export const bookings = sqliteTable("bookings", {
  id: text().primaryKey(),
  session_id: text()
    .notNull()
    .references(() => classSessions.id, { onDelete: "cascade" }),
  member_id: text()
    .notNull()
    .references(() => members.id),
  status: text().notNull().default("booked"),
  booked_at: text().notNull(),
  cancelled_at: text(),
});

export const invoices = sqliteTable("invoices", {
  id: text().primaryKey(),
  studio_id: text()
    .notNull()
    .references(() => studios.id, { onDelete: "cascade" }),
  member_id: text()
    .notNull()
    .references(() => members.id),
  number: text().notNull(),
  status: text().notNull().default("draft"),
  currency: text().notNull().default("EUR"),
  tax_rate_bps: integer().notNull().default(0),
  subtotal_cents: integer().notNull().default(0),
  tax_cents: integer().notNull().default(0),
  total_cents: integer().notNull().default(0),
  issued_at: text().notNull(),
  due_at: text(),
  paid_at: text(),
  created_at: text().notNull(),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: text().primaryKey(),
  invoice_id: text()
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text().notNull(),
  quantity: integer().notNull().default(1),
  unit_amount_cents: integer().notNull().default(0),
  amount_cents: integer().notNull().default(0),
  refunded: integer({ mode: "boolean" }).notNull().default(false),
  booking_id: text().references(() => bookings.id),
});

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text().primaryKey(),
  member_id: text()
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  kind: text().notNull(),
  payload: text().notNull(),
  created_at: text().notNull(),
  sent_at: text(),
  provider_message_id: text(),
  error: text(),
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
