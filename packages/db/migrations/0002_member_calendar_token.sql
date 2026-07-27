-- Per-member private calendar subscription token (STB-745). A member's iCal
-- feed is authorized by this secret alone (calendar clients cannot send our
-- session cookie), so it must be high-entropy and unique per member.
alter table public.members add column calendar_token text;

-- Backfill existing rows with a unique high-entropy value before the column
-- is locked down to not null + unique.
update public.members
set calendar_token = encode(gen_random_bytes(24), 'hex')
where calendar_token is null;

alter table public.members alter column calendar_token set not null;
alter table public.members add constraint members_calendar_token_key unique (calendar_token);
