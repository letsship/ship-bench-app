-- Per-member private calendar subscription tokens. Each member gets a secret
-- token that authorizes their personal iCalendar feed at
-- GET /api/ical/[token] — the token is a bearer secret (no session cookie), so
-- it must be unique and opaque.

alter table public.members
  add column ical_token text;

-- Backfill existing rows so every member immediately has a private token.
update public.members
set ical_token = gen_random_uuid()::text
where ical_token is null;

alter table public.members
  alter column ical_token set not null,
  alter column ical_token set default gen_random_uuid()::text;

create unique index idx_members_ical_token on public.members (ical_token);
