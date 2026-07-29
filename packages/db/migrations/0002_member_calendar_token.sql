-- Per-member private calendar token. Authorizes the cookieless
-- /api/ical/[token] subscription feed: a calendar client can't send our cookie,
-- so the secret in the URL is the authorization. Unknown/made-up tokens must 404
-- and never leak another member's schedule, so the token is globally unique
-- (the lookup has no studio/cookie context).
alter table public.members add column calendar_token text;

update public.members
  set calendar_token = replace(gen_random_uuid()::text, '-', '')
  where calendar_token is null;

alter table public.members alter column calendar_token set not null;

create unique index idx_members_calendar_token on public.members (calendar_token);
