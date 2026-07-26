-- Per-member calendar subscription token: a secret used to authorize
-- GET /api/ical/[token] without a session cookie (calendar clients can't send
-- cookies). Backfill existing rows with distinct random values before adding
-- the NOT NULL + UNIQUE constraints; the unique constraint doubles as the
-- lookup index.
alter table public.members add column calendar_token text;

update public.members
set calendar_token = md5(gen_random_uuid()::text || gen_random_uuid()::text)
where calendar_token is null;

alter table public.members alter column calendar_token set not null;
alter table public.members add constraint members_calendar_token_key unique (calendar_token);
