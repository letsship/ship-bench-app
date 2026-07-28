-- Add a private calendar token to every member for per-member iCal subscriptions.
-- The token is backfilled with a random hex string (48 hex chars from 24 random
-- bytes) then made not null and unique-indexed for fast O(1) lookup.

alter table public.members
  add column calendar_token text;

-- Backfill existing rows with a cryptographically random token.
-- pgcrypto (gen_random_bytes) is available on Supabase by default.
update public.members
  set calendar_token = encode(gen_random_bytes(24), 'hex')
  where calendar_token is null;

-- Now enforce: every member must have a token, and tokens must be unique.
alter table public.members
  alter column calendar_token set not null;

create unique index idx_members_calendar_token
  on public.members (calendar_token);