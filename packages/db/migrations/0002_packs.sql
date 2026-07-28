-- Class packs: prepaid bundles of class credits. A member buys a pack of
-- credits (5 or 10); each booking spends one credit (credits_remaining drops)
-- until the pack is empty. Refunding a pack voids its remaining credits.
create table public.packs (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id),
  credits_total     integer not null check (credits_total > 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index idx_packs_member on public.packs (member_id);
create index idx_packs_studio on public.packs (studio_id);

-- Row Level Security on, no policies: only the service role (used server-side
-- by the repositories) can read or write, matching 0001_init.sql.
alter table public.packs enable row level security;
