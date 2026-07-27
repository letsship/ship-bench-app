import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle schema for D1 SQLite database. Each table maps to a domain entity;
// columns are snake_case (the DB column name) mapped to camelCase domain fields
// via the `alias` property, so Drizzle rows match `lib/db/types.ts` 1:1.

export const studiosTable = sqliteTable("studios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: text("created_at").notNull(),
});

export const studioSettingsTable = sqliteTable("studio_settings", {
  studioId: text("studio_id")
    .primaryKey()
    .references(() => studiosTable.id),
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

export const membersTable = sqliteTable("members", {
  id: text("id").primaryKey(),
  studioId: text("studio_id")
    .notNull()
    .references(() => studiosTable.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  notificationsOptedOut: integer("notifications_opted_out", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
});

export const classTypesTable = sqliteTable("class_types", {
  id: text("id").primaryKey(),
  studioId: text("studio_id")
    .notNull()
    .references(() => studiosTable.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6b7280"),
  defaultCapacity: integer("default_capacity").notNull().default(12),
  defaultPriceCents: integer("default_price_cents").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const classSessionsTable = sqliteTable("class_sessions", {
  id: text("id").primaryKey(),
  studioId: text("studio_id")
    .notNull()
    .references(() => studiosTable.id),
  classTypeId: text("class_type_id")
    .notNull()
    .references(() => classTypesTable.id),
  instructor: text("instructor").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  capacity: integer("capacity").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  status: text("status").notNull().default("scheduled"),
  createdAt: text("created_at").notNull(),
});

export const bookingsTable = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => classSessionsTable.id),
  memberId: text("member_id")
    .notNull()
    .references(() => membersTable.id),
  status: text("status").notNull().default("booked"),
  bookedAt: text("booked_at").notNull(),
  cancelledAt: text("cancelled_at"),
});

export const invoicesTable = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  studioId: text("studio_id")
    .notNull()
    .references(() => studiosTable.id),
  memberId: text("member_id")
    .notNull()
    .references(() => membersTable.id),
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
  createdAt: text("created_at").notNull(),
});

export const invoiceLineItemsTable = sqliteTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoicesTable.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitAmountCents: integer("unit_amount_cents").notNull().default(0),
  amountCents: integer("amount_cents").notNull().default(0),
  refunded: integer("refunded", { mode: "boolean" }).notNull().default(false),
  bookingId: text("booking_id").references(() => bookingsTable.id),
});

export const notificationOutboxTable = sqliteTable("notification_outbox", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => membersTable.id),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
});

export const schema = {
  studiosTable,
  studioSettingsTable,
  membersTable,
  classTypesTable,
  classSessionsTable,
  bookingsTable,
  invoicesTable,
  invoiceLineItemsTable,
  notificationOutboxTable,
};
