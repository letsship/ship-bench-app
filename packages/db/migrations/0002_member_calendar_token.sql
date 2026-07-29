-- Studiobook migration 0002: per-member calendar subscription token.
-- Each member gets a secret `calendar_token` that authorizes their private
-- iCalendar feed at GET /api/ical/[token]. The token alone is the credential
-- (calendar clients can't send cookies), so the column is NOT NULL + UNIQUE and
-- an unknown token resolves to no row (the route 404s). Existing rows are
-- backfilled with a random per-row value before the constraints are applied so
-- the NOT NULL + UNIQUE hold for pre-existing members.

-- pgcrypto provides gen_random_bytes (cryptographically secure random). It is
-- enabled by default on Supabase, but create extension if missing keeps this
-- migration hermetic on a plain Postgres instance.
create extension if not exists pgcrypto;

alter table public.members add column calendar_token text;

update public.members
set calendar_token = encode(gen_random_bytes(16), 'hex')
where calendar_token is null;

alter table public.members alter column calendar_token set not null;
alter table public.members add constraint members_calendar_token_unique unique (calendar_token);
