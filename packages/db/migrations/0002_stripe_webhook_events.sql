-- =============================================================
-- STRIPE WEBHOOK EVENTS
-- Idempotency ledger for inbound Stripe webhooks. Stripe redelivers events, so
-- every event id we have finished processing is recorded here and a repeat
-- delivery becomes a no-op. The id is the Stripe event id ("evt_..."), text —
-- not a uuid like our own rows.
-- =============================================================
create table public.stripe_webhook_events (
  id           text primary key,
  processed_at timestamptz not null default now()
);

-- RLS on with no policies, matching every other table: the app reaches this
-- table only through the service role (server-side), which bypasses RLS.
alter table public.stripe_webhook_events enable row level security;
