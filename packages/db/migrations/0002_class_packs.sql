-- Class packs (prepaid class credits). A member buys a 5- or 10-credit pack, and
-- each class they book spends one credit until the pack runs out.
-- =============================================================
-- PACKS
-- =============================================================
create table public.packs (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id),
  credits_total     integer not null check (credits_total >= 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null default now()
);

create index idx_packs_member on public.packs (member_id);

alter table public.packs enable row level security;