import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Drizzle table definitions for the D1 binding. Column names are snake_case to
// match `packages/db/migrations/d1/0001_init.sql` (and the Postgres schema it
// mirrors); `lib/db/repos/d1.ts` maps rows to/from the camelCase entity types in
// `lib/db/types.ts`. Ids are TEXT (app-generated UUIDs, see `lib/db/ids.ts`) and
// timestamps are TEXT ISO-8601 strings set app-side — D1 has no uuid or
// timestamptz type, and the app already writes/reads both as plain strings.

export const studios = sqliteTable("studios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: text("created_at").notNull(),
});

export const studioSettings = sqliteTable("studio_settings", {
  studioId: text("studio_id")
    .primaryKey()
    .references(() => studios.id, { onDelete: "cascade" }),
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
  (table) => [
    unique("members_studio_id_email_unique").on(table.studioId, table.email),
    index("idx_members_studio").on(table.studioId),
  ],
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
  (table) => [index("idx_class_types_studio").on(table.studioId)],
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
  (table) => [
    index("idx_class_sessions_studio").on(table.studioId),
    index("idx_class_sessions_starts_at").on(table.startsAt),
  ],
);

export const bookings = sqliteTable(
  "bookings",
  {
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
  },
  (table) => [
    index("idx_bookings_session").on(table.sessionId),
    index("idx_bookings_member").on(table.memberId),
  ],
);

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
  (table) => [
    unique("invoices_studio_id_number_unique").on(table.studioId, table.number),
    index("idx_invoices_member").on(table.memberId),
  ],
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
  (table) => [index("idx_invoice_line_items_invoice").on(table.invoiceId)],
);

export const notificationOutbox = sqliteTable(
  "notification_outbox",
  {
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
  },
  (table) => [index("idx_notification_outbox_sent").on(table.sentAt)],
);
