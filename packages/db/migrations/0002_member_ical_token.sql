-- Per-member private calendar subscription token.
-- Each member gets an unguessable, unique `ical_token` that authorizes the
-- private `/api/ical/[token]` feed (calendar apps cannot send our auth cookie,
-- so the token in the URL is the sole authorization). Existing rows are
-- backfilled with distinct random values before the NOT NULL + UNIQUE
-- constraints are added, so every member — existing or newly created — has a
-- private token.

alter table public.members add column ical_token text;

update public.members
set ical_token = gen_random_uuid()::text
where ical_token is null;

create unique index idx_members_ical_token on public.members (ical_token);

alter table public.members alter column ical_token set not null;
