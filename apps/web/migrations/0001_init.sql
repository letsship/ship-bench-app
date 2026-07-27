-- Studiobook D1 initial schema (SQLite).
-- Translated from the Postgres schema: uuid→text, timestamptz→text,
-- boolean→integer, drop defaults (app sets ids + timestamps), preserve
-- constraints, foreign keys, and indexes.

-- =============================================================
-- STUDIOS
-- =============================================================
create table studios (
  id          text primary key,
  name        text not null,
  slug        text not null,
  timezone    text not null default 'UTC',
  created_at  text not null
);

create table studio_settings (
  studio_id                    text primary key,
  currency                     text not null default 'EUR',
  tax_rate_bps                 integer not null default 0 check (tax_rate_bps >= 0),
  cancellation_window_hours    integer not null default 12 check (cancellation_window_hours >= 0),
  waitlist_enabled             integer not null default 1,
  notify_booking_confirmations integer not null default 1,
  notify_cancellations         integer not null default 1,
  notify_waitlist_promotions   integer not null default 1,
  notify_invoices              integer not null default 1,
  foreign key (studio_id) references studios(id) on delete cascade
);

-- =============================================================
-- MEMBERS
-- =============================================================
create table members (
  id                      text primary key,
  studio_id               text not null,
  name                    text not null,
  email                   text not null,
  phone                   text,
  status                  text not null default 'active',
  notifications_opted_out integer not null default 0,
  created_at              text not null,
  unique (studio_id, email),
  foreign key (studio_id) references studios(id) on delete cascade
);

create index idx_members_studio on members (studio_id);

-- =============================================================
-- CLASS TYPES + SESSIONS
-- =============================================================
create table class_types (
  id                  text primary key,
  studio_id           text not null,
  name                text not null,
  description         text,
  color               text not null default '#6b7280',
  default_capacity    integer not null default 12 check (default_capacity >= 1),
  default_price_cents integer not null default 0 check (default_price_cents >= 0),
  created_at          text not null,
  foreign key (studio_id) references studios(id) on delete cascade
);

create table class_sessions (
  id            text primary key,
  studio_id     text not null,
  class_type_id text not null,
  instructor    text not null,
  starts_at     text not null,
  ends_at       text not null,
  capacity      integer not null check (capacity >= 1),
  price_cents   integer not null default 0 check (price_cents >= 0),
  status        text not null default 'scheduled',
  created_at    text not null,
  foreign key (studio_id) references studios(id) on delete cascade,
  foreign key (class_type_id) references class_types(id)
);

create index idx_class_sessions_studio on class_sessions (studio_id);
create index idx_class_sessions_starts_at on class_sessions (starts_at);

-- =============================================================
-- BOOKINGS
-- =============================================================
create table bookings (
  id           text primary key,
  session_id   text not null,
  member_id    text not null,
  status       text not null default 'booked',
  booked_at    text not null,
  cancelled_at text,
  foreign key (session_id) references class_sessions(id) on delete cascade,
  foreign key (member_id) references members(id)
);

create index idx_bookings_session on bookings (session_id);
create index idx_bookings_member on bookings (member_id);

-- =============================================================
-- INVOICES + LINE ITEMS
-- =============================================================
create table invoices (
  id             text primary key,
  studio_id      text not null,
  member_id      text not null,
  number         text not null,
  status         text not null default 'draft',
  currency       text not null default 'EUR',
  tax_rate_bps   integer not null default 0,
  subtotal_cents integer not null default 0,
  tax_cents      integer not null default 0,
  total_cents    integer not null default 0,
  issued_at      text not null,
  due_at         text,
  paid_at        text,
  created_at     text not null,
  unique (studio_id, number),
  foreign key (studio_id) references studios(id) on delete cascade,
  foreign key (member_id) references members(id)
);

create index idx_invoices_member on invoices (member_id);

create table invoice_line_items (
  id                text primary key,
  invoice_id        text not null,
  description       text not null,
  quantity          integer not null default 1 check (quantity >= 1),
  unit_amount_cents integer not null default 0,
  amount_cents      integer not null default 0,
  refunded          integer not null default 0,
  booking_id        text,
  foreign key (invoice_id) references invoices(id) on delete cascade,
  foreign key (booking_id) references bookings(id)
);

create index idx_invoice_line_items_invoice on invoice_line_items (invoice_id);

-- =============================================================
-- NOTIFICATION OUTBOX
-- =============================================================
create table notification_outbox (
  id                  text primary key,
  member_id           text not null,
  kind                text not null,
  payload             text not null,
  created_at          text not null,
  sent_at             text,
  provider_message_id text,
  error               text,
  foreign key (member_id) references members(id) on delete cascade
);

create index idx_notification_outbox_sent on notification_outbox (sent_at);
