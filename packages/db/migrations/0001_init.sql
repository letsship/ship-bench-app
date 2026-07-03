-- Studiobook initial schema (Postgres / Supabase).
-- Ids are application-generated, prefixed text keys (e.g. "mem_..."). Timestamps
-- are timestamptz; the app writes ISO-8601 UTC strings and reads them back the
-- same way. Row Level Security is enabled with no policies: only the service
-- role (used server-side by the repositories) can read or write.

-- =============================================================
-- STUDIOS
-- =============================================================
create table public.studios (
  id          text primary key,
  name        text not null,
  slug        text not null,
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now()
);

create table public.studio_settings (
  studio_id                    text primary key references public.studios(id) on delete cascade,
  currency                     text not null default 'EUR',
  tax_rate_bps                 integer not null default 0 check (tax_rate_bps >= 0),
  cancellation_window_hours    integer not null default 12 check (cancellation_window_hours >= 0),
  waitlist_enabled             boolean not null default true,
  notify_booking_confirmations boolean not null default true,
  notify_cancellations         boolean not null default true,
  notify_waitlist_promotions   boolean not null default true,
  notify_invoices              boolean not null default true
);

-- =============================================================
-- MEMBERS
-- =============================================================
create table public.members (
  id                      text primary key,
  studio_id               text not null references public.studios(id) on delete cascade,
  name                    text not null,
  email                   text not null,
  phone                   text,
  status                  text not null default 'active',
  notifications_opted_out boolean not null default false,
  created_at              timestamptz not null default now(),
  unique (studio_id, email)
);

create index idx_members_studio on public.members (studio_id);

-- =============================================================
-- CLASS TYPES + SESSIONS
-- =============================================================
create table public.class_types (
  id                  text primary key,
  studio_id           text not null references public.studios(id) on delete cascade,
  name                text not null,
  description         text,
  color               text not null default '#6b7280',
  default_capacity    integer not null default 12 check (default_capacity >= 1),
  default_price_cents integer not null default 0 check (default_price_cents >= 0),
  created_at          timestamptz not null default now()
);

create table public.class_sessions (
  id            text primary key,
  studio_id     text not null references public.studios(id) on delete cascade,
  class_type_id text not null references public.class_types(id),
  instructor    text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  capacity      integer not null check (capacity >= 1),
  price_cents   integer not null default 0 check (price_cents >= 0),
  status        text not null default 'scheduled',
  created_at    timestamptz not null default now()
);

create index idx_class_sessions_studio on public.class_sessions (studio_id);
create index idx_class_sessions_starts_at on public.class_sessions (starts_at);

-- =============================================================
-- BOOKINGS
-- =============================================================
create table public.bookings (
  id           text primary key,
  session_id   text not null references public.class_sessions(id) on delete cascade,
  member_id    text not null references public.members(id),
  status       text not null default 'booked',
  booked_at    timestamptz not null default now(),
  cancelled_at timestamptz
);

create index idx_bookings_session on public.bookings (session_id);
create index idx_bookings_member on public.bookings (member_id);

-- =============================================================
-- INVOICES + LINE ITEMS
-- =============================================================
create table public.invoices (
  id             text primary key,
  studio_id      text not null references public.studios(id) on delete cascade,
  member_id      text not null references public.members(id),
  number         text not null,
  status         text not null default 'draft',
  currency       text not null default 'EUR',
  tax_rate_bps   integer not null default 0,
  subtotal_cents integer not null default 0,
  tax_cents      integer not null default 0,
  total_cents    integer not null default 0,
  issued_at      timestamptz not null,
  due_at         timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (studio_id, number)
);

create index idx_invoices_member on public.invoices (member_id);

create table public.invoice_line_items (
  id                text primary key,
  invoice_id        text not null references public.invoices(id) on delete cascade,
  description       text not null,
  quantity          integer not null default 1 check (quantity >= 1),
  unit_amount_cents integer not null default 0,
  amount_cents      integer not null default 0,
  refunded          boolean not null default false,
  booking_id        text references public.bookings(id)
);

create index idx_invoice_line_items_invoice on public.invoice_line_items (invoice_id);

-- =============================================================
-- NOTIFICATION OUTBOX
-- =============================================================
create table public.notification_outbox (
  id                  text primary key,
  member_id           text not null references public.members(id) on delete cascade,
  kind                text not null,
  payload             text not null,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  provider_message_id text,
  error               text
);

create index idx_notification_outbox_sent on public.notification_outbox (sent_at);

-- =============================================================
-- Row Level Security — on for every table, no policies. The app accesses these
-- tables exclusively via the service role (server-side), which bypasses RLS.
-- =============================================================
alter table public.studios enable row level security;
alter table public.studio_settings enable row level security;
alter table public.members enable row level security;
alter table public.class_types enable row level security;
alter table public.class_sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.notification_outbox enable row level security;
