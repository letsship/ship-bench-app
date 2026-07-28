-- Per-member private calendar subscription token.
-- Each member gets a secret token used in the /api/ical/[token] feed URL; the
-- token itself is the authorization (calendar clients can't send cookies), so
-- it must be unique and present on every member.

alter table public.members
  add column calendar_token text;

-- Backfill existing members before enforcing NOT NULL.
update public.members
set calendar_token = gen_random_uuid()::text
where calendar_token is null;

alter table public.members
  alter column calendar_token set not null;

-- A token resolves to exactly one member, and lookups by token stay fast.
alter table public.members
  add constraint members_calendar_token_unique unique (calendar_token);

create index idx_members_calendar_token on public.members (calendar_token);
