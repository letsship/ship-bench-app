alter table public.members
  add column calendar_token text;

update public.members
set calendar_token = replace(gen_random_uuid()::text, '-', '')
where calendar_token is null;

alter table public.members
  alter column calendar_token set default replace(gen_random_uuid()::text, '-', ''),
  alter column calendar_token set not null,
  add constraint members_calendar_token_key unique (calendar_token);

create index idx_members_calendar_token on public.members (calendar_token);
