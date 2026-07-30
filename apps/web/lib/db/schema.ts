import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Drizzle SQLite (D1) schema mirroring `apps/web/migrations/0001_init.sql`.
// Column names are snake_case (matching the D1 migration); the JS property keys
// are camelCase and line up 1:1 with the entity types in `lib/db/types.ts`, so
// a Drizzle row IS a domain row — no snake/camel mapping helper is needed on
// this path. Timestamps are stored as ISO-8601 UTC text and booleans as
// integers (`mode: "boolean"`) so they round-trip to the entity types.

export const studios = sqliteTable("studios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: text("created_at").notNull(),
});

export const studioSettings = sqliteTable(
  "studio_settings",
  {
    studioId: text("studio_id")
      .notNull()
      .primaryKey()
      .references(() => studios.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("EUR"),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    cancellationWindowHours: integer("cancellation_window_hours").notNull().default(12),
    waitlistEnabled: integer("waitlist_enabled", { mode: "boolean" }).notNull().default(true),
    notifyBookingConfirmations: integer("notify_booking_confirmations", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    notifyCancellations: integer("notify_cancellations", { mode: "boolean" })
      .notNull()
      .default(true),
    notifyWaitlistPromotions: integer("notify_waitlist_promotions", { mode: "boolean" })
      .notNull()
      .default(true),
    notifyInvoices: integer("notify_invoices", { mode: "boolean" }).notNull().default(true),
  },
  (table) => ({
    taxRateBpsCheck: check("studio_settings_tax_rate_bps_check", sql`${table.taxRateBps} >= 0`),
    cancellationWindowHoursCheck: check(
      "studio_settings_cancellation_window_hours_check",
      sql`${table.cancellationWindowHours} >= 0`,
    ),
  }),
);

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    status: text("status").notNull().default("active"),
    notificationsOptedOut: integer("notifications_opted_out", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    studioEmailUnique: unique("members_studio_id_email_unique").on(table.studioId, table.email),
  }),
);

export const classTypes = sqliteTable(
  "class_types",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#6b7280"),
    defaultCapacity: integer("default_capacity").notNull().default(12),
    defaultPriceCents: integer("default_price_cents").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    defaultCapacityCheck: check("class_types_default_capacity_check", sql`${table.defaultCapacity} >= 1`),
    defaultPriceCentsCheck: check(
      "class_types_default_price_cents_check",
      sql`${table.defaultPriceCents} >= 0`,
    ),
  }),
);

export const classSessions = sqliteTable(
  "class_sessions",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    classTypeId: text("class_type_id")
      .notNull()
      .references(() => classTypes.id),
    instructor: text("instructor").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    capacity: integer("capacity").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    status: text("status").notNull().default("scheduled"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    capacityCheck: check("class_sessions_capacity_check", sql`${table.capacity} >= 1`),
    priceCentsCheck: check("class_sessions_price_cents_check", sql`${table.priceCents} >= 0`),
  }),
);

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => classSessions.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  status: text("status").notNull().default("booked"),
  bookedAt: text("booked_at").notNull(),
  cancelledAt: text("cancelled_at"),
});

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    studioId: text("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id),
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
  },
  (table) => ({
    studioNumberUnique: unique("invoices_studio_id_number_unique").on(table.studioId, table.number),
  }),
);

export const invoiceLineItems = sqliteTable(
  "invoice_line_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitAmountCents: integer("unit_amount_cents").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    refunded: integer("refunded", { mode: "boolean" }).notNull().default(false),
    bookingId: text("booking_id").references(() => bookings.id),
  },
  (table) => ({
    quantityCheck: check("invoice_line_items_quantity_check", sql`${table.quantity} >= 1`),
  }),
);

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
});

// Re-exported so the migration-driven test harness and any tooling can import
// the whole schema as one bundle.
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

export type DatabaseSchema = typeof schema;
