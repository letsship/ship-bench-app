-- Stripe webhook idempotency ledger. One row per processed event; the primary
-- key is the provider's event id (e.g. "evt_..."), so a redelivered event is
-- detected and skipped instead of being processed twice.

create table public.webhook_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- Same RLS posture as every other table: enabled with no policies — only the
-- service role (used server-side by the repositories) can read or write.
alter table public.webhook_events enable row level security;
