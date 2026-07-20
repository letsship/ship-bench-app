-- Add per-member calendar subscription token to allow members to subscribe
-- to a private feed of only their booked sessions.
alter table public.members
  add column calendar_token text not null default (gen_random_uuid()::text);

create unique index members_calendar_token_key on public.members (calendar_token);
