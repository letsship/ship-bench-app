-- Per-member private calendar token: the secret in GET /api/ical/[token] that
-- authorizes a member's feed without a session cookie. Backfill existing rows
-- with unguessable random values BEFORE enforcing NOT NULL + uniqueness, so
-- the migration is safe on populated instances.

alter table public.members add column calendar_token text;

update public.members
set calendar_token = replace(gen_random_uuid()::text, '-', '')
where calendar_token is null;

alter table public.members alter column calendar_token set not null;

create unique index idx_members_calendar_token on public.members (calendar_token);
