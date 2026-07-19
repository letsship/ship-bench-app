-- Add private calendar token to members for per-member calendar subscription.
-- Each member gets a unique, URL-safe secret that authorizes their personal
-- calendar feed without requiring authentication cookies (calendar apps can't
-- authenticate that way).

alter table public.members add column calendar_token text;

-- Backfill existing members with random secrets. This is a one-time migration,
-- so we're OK generating here (the app regenerates on demand in production).
update public.members set calendar_token = replace(gen_random_uuid()::text, '-', '');

alter table public.members alter column calendar_token set not null;

-- Ensure every member has a distinct token (index also enables fast lookup).
create unique index idx_members_calendar_token on public.members (calendar_token);
