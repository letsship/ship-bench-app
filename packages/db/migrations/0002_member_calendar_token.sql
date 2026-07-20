-- Add per-member calendar subscription token.
-- Every member gets a private, unguessable token to subscribe to their own
-- class calendar without sharing credentials.

alter table public.members
  add column calendar_token text;

-- Backfill existing rows with fresh UUIDs.
update public.members
  set calendar_token = gen_random_uuid()::text
  where calendar_token is null;

-- Make the column mandatory and unique (only within non-null values, but we
-- ensure all are non-null).
alter table public.members
  alter column calendar_token set not null;

create unique index idx_members_calendar_token on public.members (calendar_token);
