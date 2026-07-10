-- Idempotency ledger for Stripe webhook deliveries. Stripe retries webhook
-- delivery on any non-2xx response (and can otherwise send an event more than
-- once), so the event id is recorded here the first time it is processed;
-- subsequent deliveries of the same id are no-ops.
create table public.processed_stripe_events (
  id         text primary key,
  type       text not null,
  created_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;
