-- Webhook idempotency store: records Stripe event ids to prevent double-processing.

create table public.webhook_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- Row Level Security — on for every table, no policies. The app accesses this
-- table exclusively via the service role (server-side), which bypasses RLS.
alter table public.webhook_events enable row level security;
