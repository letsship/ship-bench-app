-- Add calendar_token to members table for per-member calendar subscriptions.
-- Each member gets a unique secret token that authorizes access to their
-- personal calendar feed.

alter table public.members
  add column calendar_token text;

-- Backfill existing rows with random hex-encoded tokens.
update public.members
  set calendar_token = encode(gen_random_bytes(16), 'hex')
  where calendar_token is null;

-- Make NOT NULL and ensure uniqueness.
alter table public.members
  alter column calendar_token set not null,
  add constraint calendar_token_unique unique (calendar_token);

-- Index for O(1) lookups by token.
create index idx_members_calendar_token on public.members (calendar_token);
