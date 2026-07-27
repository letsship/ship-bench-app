-- Private per-member calendar subscription token (see GET /api/ical/[token]).
-- The token itself authorizes the feed, so it must be unguessable, unique,
-- and always present — hence the backfill before the not-null constraint.
alter table public.members add column calendar_token text;

update public.members set calendar_token = gen_random_uuid()::text where calendar_token is null;

alter table public.members alter column calendar_token set not null;

create unique index idx_members_calendar_token on public.members (calendar_token);
