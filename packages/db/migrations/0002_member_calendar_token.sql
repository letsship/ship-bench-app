-- Add calendar_token field to members table for per-member calendar subscriptions.
-- Each member gets a unique, URL-safe secret token that authorizes access to their
-- personal calendar feed at GET /api/ical/[token].

alter table public.members add column calendar_token text;

-- Backfill existing rows with unique random tokens before making the column NOT NULL.
-- Using gen_random_uuid() cast to text produces a URL-safe hex string.
update public.members set calendar_token = encode(gen_random_bytes(32), 'hex') where calendar_token is null;

-- Enforce NOT NULL and uniqueness.
alter table public.members alter column calendar_token set not null;
create unique index idx_members_calendar_token on public.members (calendar_token);
