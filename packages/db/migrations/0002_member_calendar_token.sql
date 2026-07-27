-- Add private calendar token to members for per-member subscription
alter table public.members
add column calendar_token text;

-- Backfill with a random unguessable value for existing rows
update public.members
set calendar_token = encode(gen_random_bytes(16), 'hex')
where calendar_token is null;

-- Make it required and unique
alter table public.members
alter column calendar_token set not null,
add constraint members_calendar_token_unique unique (calendar_token);

-- Index for lookups
create index idx_members_calendar_token on public.members(calendar_token);
