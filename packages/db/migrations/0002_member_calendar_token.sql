-- Private per-member calendar token. GET /api/ical/[token] returns the
-- member's personal iCalendar feed; the unguessable token in the URL is the
-- sole authorization (calendar clients cannot send cookies), so every member
-- must have one and no two members may share one.

-- The volatile default both backfills existing rows and covers any DB-side
-- insert that omits the column (the app normally generates tokens app-side).
alter table public.members
  add column calendar_token text default replace(gen_random_uuid()::text, '-', '');

-- Defensive: guarantee no null slips through before tightening the column.
update public.members
  set calendar_token = replace(gen_random_uuid()::text, '-', '')
  where calendar_token is null;

alter table public.members
  alter column calendar_token set not null;

create unique index idx_members_calendar_token on public.members (calendar_token);
