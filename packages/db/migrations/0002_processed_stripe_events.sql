-- Idempotency ledger for incoming Stripe webhooks. Stripe delivers each event
-- at least once, so the event id is recorded the first time it is handled and a
-- redelivery is recognised and skipped. Ids are Stripe's own (`evt_…`), hence
-- text rather than uuid. RLS is on with no policies, matching 0001_init.sql:
-- only the service role (used server-side by the repositories) can touch it.

create table public.processed_stripe_events (
  id          text primary key,
  received_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;
