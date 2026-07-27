-- Add per-member calendar subscription token for private iCalendar feeds.
-- Each member gets a unique secret token (high-entropy hex) that authorizes
-- access to their personal calendar feed at GET /api/ical/[token].

alter table public.members add column calendar_token text;

-- Backfill existing rows with random tokens. The UUID->hex conversion gives
-- us collision-free, unguessable tokens without a separate sequence.
update public.members set calendar_token = replace(gen_random_uuid()::text, '-', '');

-- Enforce: every member must have a token, and each token must be unique
-- (tokens are primary lookups for calendar access).
alter table public.members alter column calendar_token set not null;
alter table public.members add constraint idx_members_calendar_token unique (calendar_token);
