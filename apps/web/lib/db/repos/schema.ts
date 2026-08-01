import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const id = (name: string) => text(name).notNull();
const timestamp = (name: string) => text(name).notNull();

export const studios = sqliteTable("studios", {
  id: id("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: timestamp("created_at"),
});

export const studioSettings = sqliteTable("studio_settings", {
  studioId: id("studio_id").primaryKey().references(() => studios.id, { onDelete: "cascade" }),
  currency: text("currency").notNull().default("EUR"),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  cancellationWindowHours: integer("cancellation_window_hours").notNull().default(12),
  waitlistEnabled: integer("waitlist_enabled", { mode: "boolean" }).notNull().default(true),
  notifyBookingConfirmations: integer("notify_booking_confirmations", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyCancellations: integer("notify_cancellations", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyWaitlistPromotions: integer("notify_waitlist_promotions", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyInvoices: integer("notify_invoices", { mode: "boolean" }).notNull().default(true),
});

export const members = sqliteTable("members", {
  id: id("id").primaryKey(),
  studioId: id("studio_id").references(() => studios.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  notificationsOptedOut: integer("notifications_opted_out", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: timestamp("created_at"),
});

export const classTypes = sqliteTable("class_types", {
  id: id("id").primaryKey(),
  studioId: id("studio_id").references(() => studios.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6b7280"),
  defaultCapacity: integer("default_capacity").notNull().default(12),
  defaultPriceCents: integer("default_price_cents").notNull().default(0),
  createdAt: timestamp("created_at"),
});

export const classSessions = sqliteTable("class_sessions", {
  id: id("id").primaryKey(),
  studioId: id("studio_id").references(() => studios.id, { onDelete: "cascade" }).notNull(),
  classTypeId: id("class_type_id").references(() => classTypes.id).notNull(),
  instructor: text("instructor").notNull(),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  capacity: integer("capacity").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at"),
});

export const bookings = sqliteTable("bookings", {
  id: id("id").primaryKey(),
  sessionId: id("session_id").references(() => classSessions.id, { onDelete: "cascade" }).notNull(),
  memberId: id("member_id").references(() => members.id).notNull(),
  status: text("status").notNull().default("booked"),
  bookedAt: timestamp("booked_at"),
  cancelledAt: text("cancelled_at"),
});

export const invoices = sqliteTable("invoices", {
  id: id("id").primaryKey(),
  studioId: id("studio_id").references(() => studios.id, { onDelete: "cascade" }).notNull(),
  memberId: id("member_id").references(() => members.id).notNull(),
  number: text("number").notNull(),
  status: text("status").notNull().default("draft"),
  currency: text("currency").notNull().default("EUR"),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  issuedAt: timestamp("issued_at"),
  dueAt: text("due_at"),
  paidAt: text("paid_at"),
  createdAt: timestamp("created_at"),
});

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: id("id").primaryKey(),
  invoiceId: id("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitAmountCents: integer("unit_amount_cents").notNull().default(0),
  amountCents: integer("amount_cents").notNull().default(0),
  refunded: integer("refunded", { mode: "boolean" }).notNull().default(false),
  bookingId: text("booking_id").references(() => bookings.id),
});

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: id("id").primaryKey(),
  memberId: id("member_id").references(() => members.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at"),
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
