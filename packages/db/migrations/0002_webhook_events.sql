-- Processed Stripe webhook event ids. Stripe redelivers events, so we record
-- every event id we've handled to make webhook processing idempotent.
create table public.webhook_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;
