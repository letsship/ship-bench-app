-- Add per-member calendar subscription token.
-- Each member gets a unique, unguessable token that authorizes access to their
-- private calendar feed without requiring a session cookie (calendar apps can't
-- send cookies).

alter table public.members add column calendar_token text;

-- Backfill existing rows with distinct random tokens. Use gen_random_uuid()
-- converted to text for sufficient entropy.
update public.members set calendar_token = encode(gen_random_bytes(32), 'hex') where calendar_token is null;

-- Make the column required and add a unique constraint.
alter table public.members alter column calendar_token set not null;

create unique index idx_members_calendar_token on public.members (calendar_token);
