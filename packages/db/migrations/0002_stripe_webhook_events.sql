-- Idempotency store for Stripe payment webhooks. The Stripe event id is the
-- primary key: the webhook handler checks this table before processing an
-- event and always records the event afterward, so a Stripe retry (or a
-- literal redelivery of the same event) is a no-op on the second delivery.

create table public.stripe_webhook_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
