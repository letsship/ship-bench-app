CREATE TABLE studios (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'UTC',
  created_at  text NOT NULL
);

CREATE TABLE studio_settings (
  studio_id                    text PRIMARY KEY REFERENCES studios(id) ON DELETE CASCADE,
  currency                     text NOT NULL DEFAULT 'EUR',
  tax_rate_bps                 integer NOT NULL DEFAULT 0 CHECK (tax_rate_bps >= 0),
  cancellation_window_hours    integer NOT NULL DEFAULT 12 CHECK (cancellation_window_hours >= 0),
  waitlist_enabled             integer NOT NULL DEFAULT 1,
  notify_booking_confirmations integer NOT NULL DEFAULT 1,
  notify_cancellations         integer NOT NULL DEFAULT 1,
  notify_waitlist_promotions   integer NOT NULL DEFAULT 1,
  notify_invoices              integer NOT NULL DEFAULT 1
);

CREATE TABLE members (
  id                      text PRIMARY KEY,
  studio_id               text NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  email                   text NOT NULL,
  phone                   text,
  status                  text NOT NULL DEFAULT 'active',
  notifications_opted_out integer NOT NULL DEFAULT 0,
  created_at              text NOT NULL,
  UNIQUE (studio_id, email)
);

CREATE INDEX idx_members_studio ON members (studio_id);

CREATE TABLE class_types (
  id                  text PRIMARY KEY,
  studio_id           text NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  color               text NOT NULL DEFAULT '#6b7280',
  default_capacity    integer NOT NULL DEFAULT 12 CHECK (default_capacity >= 1),
  default_price_cents integer NOT NULL DEFAULT 0 CHECK (default_price_cents >= 0),
  created_at          text NOT NULL
);

CREATE TABLE class_sessions (
  id            text PRIMARY KEY,
  studio_id     text NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  class_type_id text NOT NULL REFERENCES class_types(id),
  instructor    text NOT NULL,
  starts_at     text NOT NULL,
  ends_at       text NOT NULL,
  capacity      integer NOT NULL CHECK (capacity >= 1),
  price_cents   integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  status        text NOT NULL DEFAULT 'scheduled',
  created_at    text NOT NULL
);

CREATE INDEX idx_class_sessions_studio ON class_sessions (studio_id);
CREATE INDEX idx_class_sessions_starts_at ON class_sessions (starts_at);

CREATE TABLE bookings (
  id           text PRIMARY KEY,
  session_id   text NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  member_id    text NOT NULL REFERENCES members(id),
  status       text NOT NULL DEFAULT 'booked',
  booked_at    text NOT NULL,
  cancelled_at text
);

CREATE INDEX idx_bookings_session ON bookings (session_id);
CREATE INDEX idx_bookings_member ON bookings (member_id);

CREATE TABLE invoices (
  id             text PRIMARY KEY,
  studio_id      text NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  member_id      text NOT NULL REFERENCES members(id),
  number         text NOT NULL,
  status         text NOT NULL DEFAULT 'draft',
  currency       text NOT NULL DEFAULT 'EUR',
  tax_rate_bps   integer NOT NULL DEFAULT 0,
  subtotal_cents integer NOT NULL DEFAULT 0,
  tax_cents      integer NOT NULL DEFAULT 0,
  total_cents    integer NOT NULL DEFAULT 0,
  issued_at      text NOT NULL,
  due_at         text,
  paid_at        text,
  created_at     text NOT NULL,
  UNIQUE (studio_id, number)
);

CREATE INDEX idx_invoices_member ON invoices (member_id);

CREATE TABLE invoice_line_items (
  id                text PRIMARY KEY,
  invoice_id        text NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description       text NOT NULL,
  quantity          integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_amount_cents integer NOT NULL DEFAULT 0,
  amount_cents      integer NOT NULL DEFAULT 0,
  refunded          integer NOT NULL DEFAULT 0,
  booking_id        text REFERENCES bookings(id)
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items (invoice_id);

CREATE TABLE notification_outbox (
  id                  text PRIMARY KEY,
  member_id           text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind                text NOT NULL,
  payload             text NOT NULL,
  created_at          text NOT NULL,
  sent_at             text,
  provider_message_id text,
  error               text
);

CREATE INDEX idx_notification_outbox_sent ON notification_outbox (sent_at);
