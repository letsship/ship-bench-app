-- Idempotency ledger for received Stripe webhook deliveries. The primary key is
-- the Stripe event id (text, e.g. "evt_..."), so a replayed delivery cannot be
-- recorded — and therefore cannot be processed — twice, even at the database
-- level. Timestamps follow the 0001 convention (timestamptz, ISO-8601 UTC).

create table public.stripe_webhook_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- Row Level Security on with no policies, matching 0001: only the service role
-- (used server-side by the repositories) can read or write.
alter table public.stripe_webhook_events enable row level security;
