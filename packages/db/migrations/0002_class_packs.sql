-- Studiobook class packs (Postgres / Supabase).
-- A member buys a prepaid bundle of credits (a 5- or 10-credit pack); each
-- confirmed booking spends one credit from their oldest active pack until it
-- runs out. Refunding a pack voids its remaining credits (status 'refunded') so
-- they can no longer be drawn from. Row Level Security is enabled with no
-- policies: only the service role (used server-side by the repositories) can
-- read or write.

-- =============================================================
-- CLASS PACKS
-- =============================================================
create table public.class_packs (
  id               uuid primary key default gen_random_uuid(),
  studio_id        uuid not null references public.studios(id) on delete cascade,
  member_id        uuid not null references public.members(id) on delete cascade,
  credits_total    integer not null check (credits_total >= 1),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents      integer not null check (price_cents >= 0),
  status           text not null default 'active',
  purchased_at     timestamptz not null,
  created_at       timestamptz not null default now()
);

create index idx_class_packs_member on public.class_packs (member_id);

-- =============================================================
-- Row Level Security — on with no policies. The app accesses this table
-- exclusively via the service role (server-side), which bypasses RLS.
-- =============================================================
alter table public.class_packs enable row level security;
