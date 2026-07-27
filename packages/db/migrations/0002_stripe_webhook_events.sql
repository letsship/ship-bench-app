-- Stripe webhook event tracking for idempotency.
-- Stores processed Stripe event IDs to prevent double-processing webhook re-deliveries.

create table public.stripe_webhook_events (
  event_id    text primary key,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
