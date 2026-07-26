-- Per-member private calendar subscription token. The token itself is the
-- authorization for GET /api/ical/[token] (calendar apps can't send our
-- session cookie), so it must be unique and unguessable.
alter table public.members
  add column calendar_token text not null unique;

create index idx_members_calendar_token on public.members (calendar_token);
