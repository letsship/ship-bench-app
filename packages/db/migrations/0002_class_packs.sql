-- Studiobook class packs (prepaid class credits). A member buys a pack of
-- credits and each booking spends one until the pack runs out; refunding voids
-- the remaining credits. Matches the conventions of 0001_init.sql: uuid ids
-- generated app-side, timestamptz timestamps, RLS enabled with no policies
-- (the app accesses these via the service role only).

-- =============================================================
-- CLASS PACKS
-- =============================================================
create table public.class_packs (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id) on delete cascade,
  credits_total     integer not null check (credits_total >= 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null,
  created_at        timestamptz not null default now()
);

create index idx_class_packs_member on public.class_packs (member_id);

-- =============================================================
-- Row Level Security — on, no policies. Only the service role (server-side)
-- reads or writes these rows.
-- =============================================================
alter table public.class_packs enable row level security;
