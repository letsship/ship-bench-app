-- Add a unique calendar_token column to the members table for per-member
-- calendar subscriptions. Each member can subscribe to only their own booked
-- sessions via a secret token in the URL.

alter table public.members add column calendar_token text not null unique default encode(gen_random_bytes(16), 'hex');

create index idx_members_calendar_token on public.members (calendar_token);
