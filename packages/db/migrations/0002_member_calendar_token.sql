-- Add calendar_token column to members table for per-member calendar subscriptions
-- Each member gets a unique random token that serves as the authorization
-- mechanism for their private calendar feed (no session cookie required).

alter table public.members
add column calendar_token text not null default encode(gen_random_bytes(16), 'hex');

-- Backfill existing rows with unique tokens; the DEFAULT will handle new rows.
update public.members
set calendar_token = encode(gen_random_bytes(16), 'hex')
where calendar_token = encode(gen_random_bytes(16), 'hex');

-- Ensure uniqueness for token-based lookups.
create unique index idx_members_calendar_token on public.members (calendar_token);
