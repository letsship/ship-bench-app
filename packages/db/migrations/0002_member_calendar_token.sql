-- Add per-member calendar subscription tokens
alter table public.members
  add column calendar_token text not null default replace(gen_random_uuid()::text, '-', '');

-- Unique constraint to prevent token collisions
alter table public.members
  add constraint members_calendar_token_unique unique (calendar_token);

-- Index for token lookups
create index idx_members_calendar_token on public.members (calendar_token);
