-- Idempotency ledger for inbound Stripe webhooks. The id column holds
-- Stripe's own event id (e.g. "evt_..."), which is globally unique, so
-- recording it here doubles as the dedupe key for replayed deliveries.
create table public.stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
