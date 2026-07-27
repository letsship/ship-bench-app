import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Drizzle schema for the D1 (SQLite) database. Column keys are camelCase to
// match the entity types in `../types` 1:1 (Drizzle returns rows already
// shaped this way — no snake/camel mapping layer needed); the DB column names
// stay snake_case, mirroring `migrations/0001_init.sql`. Ids and timestamps
// are app-supplied text (uuid / ISO-8601), never DB-generated defaults.

export const studios = sqliteTable("studios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").notNull(),
  createdAt: text("created_at").notNull(),
});

export const studioSettings = sqliteTable("studio_settings", {
  studioId: text("studio_id")
    .primaryKey()
    .references(() => studios.id),
  currency: text("currency").notNull(),
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
    status: text("status").notNull(),
    notificationsOptedOut: integer("notifications_opted_out", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [unique().on(table.studioId, table.email)],
);

export const classTypes = sqliteTable("class_types", {
  id: text("id").primaryKey(),
  studioId: text("studio_id")
    .notNull()
    .references(() => studios.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull(),
  defaultCapacity: integer("default_capacity").notNull(),
  defaultPriceCents: integer("default_price_cents").notNull(),
  createdAt: text("created_at").notNull(),
});

export const classSessions = sqliteTable("class_sessions", {
  id: text("id").primaryKey(),
  studioId: text("studio_id")
    .notNull()
    .references(() => studios.id),
  classTypeId: text("class_type_id")
    .notNull()
    .references(() => classTypes.id),
  instructor: text("instructor").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  capacity: integer("capacity").notNull(),
  priceCents: integer("price_cents").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => classSessions.id),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  status: text("status").notNull(),
  bookedAt: text("booked_at").notNull(),
  cancelledAt: text("cancelled_at"),
});

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
    status: text("status").notNull(),
    currency: text("currency").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    issuedAt: text("issued_at").notNull(),
    dueAt: text("due_at"),
    paidAt: text("paid_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [unique().on(table.studioId, table.number)],
);

export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitAmountCents: integer("unit_amount_cents").notNull(),
  amountCents: integer("amount_cents").notNull(),
  refunded: integer("refunded", { mode: "boolean" }).notNull(),
  bookingId: text("booking_id").references(() => bookings.id),
});

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
});
