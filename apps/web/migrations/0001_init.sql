-- Studiobook initial schema (SQLite / Cloudflare D1).
-- Primary keys are TEXT (UUIDs generated app-side); timestamps are TEXT
-- (the app writes ISO-8601 UTC strings and reads them back the same way).
-- Booleans are INTEGER (0/1).

-- =============================================================
-- STUDIOS
-- =============================================================
CREATE TABLE studios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL
);

CREATE TABLE studio_settings (
  studio_id TEXT PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'EUR',
  tax_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bps >= 0),
  cancellation_window_hours INTEGER NOT NULL DEFAULT 12 CHECK (cancellation_window_hours >= 0),
  waitlist_enabled INTEGER NOT NULL DEFAULT 1,
  notify_booking_confirmations INTEGER NOT NULL DEFAULT 1,
  notify_cancellations INTEGER NOT NULL DEFAULT 1,
  notify_waitlist_promotions INTEGER NOT NULL DEFAULT 1,
  notify_invoices INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

-- =============================================================
-- MEMBERS
-- =============================================================
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notifications_opted_out INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  UNIQUE (studio_id, email)
);

CREATE INDEX idx_members_studio ON members (studio_id);

-- =============================================================
-- CLASS TYPES + SESSIONS
-- =============================================================
CREATE TABLE class_types (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6b7280',
  default_capacity INTEGER NOT NULL DEFAULT 12 CHECK (default_capacity >= 1),
  default_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (default_price_cents >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

CREATE TABLE class_sessions (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  class_type_id TEXT NOT NULL,
  instructor TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 1),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (class_type_id) REFERENCES class_types(id)
);

CREATE INDEX idx_class_sessions_studio ON class_sessions (studio_id);
CREATE INDEX idx_class_sessions_starts_at ON class_sessions (starts_at);

-- =============================================================
-- BOOKINGS
-- =============================================================
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  booked_at TEXT NOT NULL,
  cancelled_at TEXT,
  FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX idx_bookings_session ON bookings (session_id);
CREATE INDEX idx_bookings_member ON bookings (member_id);

-- =============================================================
-- INVOICES + LINE ITEMS
-- =============================================================
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'EUR',
  tax_rate_bps INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL,
  due_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id),
  UNIQUE (studio_id, number)
);

CREATE INDEX idx_invoices_member ON invoices (member_id);

CREATE TABLE invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_amount_cents INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  refunded INTEGER NOT NULL DEFAULT 0,
  booking_id TEXT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items (invoice_id);

-- =============================================================
-- NOTIFICATION OUTBOX
-- =============================================================
CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  provider_message_id TEXT,
  error TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE INDEX idx_notification_outbox_sent ON notification_outbox (sent_at);
