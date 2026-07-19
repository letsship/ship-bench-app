-- Studiobook D1 schema: SQLite tables backing the repository interfaces.
-- Column names are snake_case; the Drizzle ORM schema maps them transparently
-- to camelCase entity types.

CREATE TABLE studios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE studio_settings (
  studio_id TEXT PRIMARY KEY,
  currency TEXT NOT NULL,
  tax_rate_bps INTEGER NOT NULL,
  cancellation_window_hours INTEGER NOT NULL,
  waitlist_enabled INTEGER NOT NULL,
  notify_booking_confirmations INTEGER NOT NULL,
  notify_cancellations INTEGER NOT NULL,
  notify_waitlist_promotions INTEGER NOT NULL,
  notify_invoices INTEGER NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL,
  notifications_opted_out INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE class_types (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  default_capacity INTEGER NOT NULL,
  default_price_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE class_sessions (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  class_type_id TEXT NOT NULL,
  instructor TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  booked_at TEXT NOT NULL,
  cancelled_at TEXT
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  tax_rate_bps INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  issued_at TEXT NOT NULL,
  due_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_amount_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  refunded INTEGER NOT NULL,
  booking_id TEXT
);

CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  provider_message_id TEXT,
  error TEXT
);
