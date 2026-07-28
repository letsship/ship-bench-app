import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle schema for the Cloudflare D1 (SQLite) persistence adapter. Each table
// mirrors the columns in `apps/web/migrations/0001_init.sql` 1:1. The JS
// property names are camelCase (matching the entity types in `lib/db/types.ts`)
// and the on-disk columns are snake_case — Drizzle performs the mapping, so the
// D1 adapter hands entities in and gets entities out with no manual key
// shuffling. Type mapping: uuid/timestamp columns are TEXT (the app writes ISO
// UTC strings), booleans are INTEGER 0/1 via `{ mode: "boolean" }`, and all
// other numerics are INTEGER. This is the single schema object the D1 adapter
// and its test consume.

export const studios = sqliteTable("studios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: text("created_at").notNull().default("current_timestamp"),
});

export const studioSettings = sqliteTable("studio_settings", {
  studioId: text("studio_id").primaryKey(),
  currency: text("currency").notNull().default("EUR"),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  cancellationWindowHours: integer("cancellation_window_hours").notNull().default(12),
  waitlistEnabled: integer("waitlist_enabled", { mode: "boolean" }).notNull().default(true),
  notifyBookingConfirmations: integer("notify_booking_confirmations", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyCancellations: integer("notify_cancellations", { mode: "boolean" }).notNull().default(true),
  notifyWaitlistPromotions: integer("notify_waitlist_promotions", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyInvoices: integer("notify_invoices", { mode: "boolean" }).notNull().default(true),
});

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  notificationsOptedOut: integer("notifications_opted_out", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull().default("current_timestamp"),
});

export const classTypes = sqliteTable("class_types", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6b7280"),
  defaultCapacity: integer("default_capacity").notNull().default(12),
  defaultPriceCents: integer("default_price_cents").notNull().default(0),
  createdAt: text("created_at").notNull().default("current_timestamp"),
});

export const classSessions = sqliteTable("class_sessions", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull(),
  classTypeId: text("class_type_id").notNull(),
  instructor: text("instructor").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  capacity: integer("capacity").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  status: text("status").notNull().default("scheduled"),
  createdAt: text("created_at").notNull().default("current_timestamp"),
});

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  memberId: text("member_id").notNull(),
  status: text("status").notNull().default("booked"),
  bookedAt: text("booked_at").notNull().default("current_timestamp"),
  cancelledAt: text("cancelled_at"),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  studioId: text("studio_id").notNull(),
  memberId: text("member_id").notNull(),
  number: text("number").notNull(),
  status: text("status").notNull().default("draft"),
  currency: text("currency").notNull().default("EUR"),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  issuedAt: text("issued_at").notNull(),
  dueAt: text("due_at"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").notNull().default("current_timestamp"),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitAmountCents: integer("unit_amount_cents").notNull().default(0),
  amountCents: integer("amount_cents").notNull().default(0),
  refunded: integer("refunded", { mode: "boolean" }).notNull().default(false),
  bookingId: text("booking_id"),
});

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default("current_timestamp"),
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

export type Schema = typeof schema;
