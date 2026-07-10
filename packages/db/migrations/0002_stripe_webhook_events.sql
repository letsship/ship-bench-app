-- Stripe webhook idempotency. Keyed by Stripe's own event id (e.g. "evt_..."),
-- not an app-generated uuid: recording an insert against this primary key is
-- the atomic "have we seen this event before?" check for webhook replays.

create table public.stripe_webhook_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
