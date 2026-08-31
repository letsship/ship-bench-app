-- Stripe webhook event idempotency log. The Stripe event id is the primary key,
-- so a replayed event insert fails / is treated as already-processed — that is
-- what makes the webhook receiver idempotent at the database layer. Row Level
-- Security is enabled with no policies: only the service role (used server-side
-- by the repositories) can read or write, matching 0001_init.sql conventions.

create table public.webhook_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;
