-- Per-member private calendar subscription token.
-- Each member gets an unguessable secret that authorizes GET /api/ical/:token —
-- calendar clients (Apple/Google Calendar) cannot send our session cookie, so
-- the secret link itself is the authorization. Existing rows are backfilled
-- before the not-null constraint is applied. New rows get their token app-side
-- (lib/db/ids.ts newCalendarToken), matching how ids are generated.

alter table public.members add column calendar_token text;

update public.members
   set calendar_token = replace(gen_random_uuid()::text, '-', '')
 where calendar_token is null;

alter table public.members alter column calendar_token set not null;

create unique index idx_members_calendar_token on public.members (calendar_token);
