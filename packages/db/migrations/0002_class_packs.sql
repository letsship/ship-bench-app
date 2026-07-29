-- Class packs: prepaid bundles of class credits. A member buys a 5- or
-- 10-credit pack; each booking spends one credit (oldest pack first) until the
-- pack runs out, and refunding a pack voids its remaining credits.

create table public.class_packs (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id),
  credits_total     integer not null check (credits_total >= 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null default 0 check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null,
  created_at        timestamptz not null default now()
);

create index idx_class_packs_member on public.class_packs (member_id);
create index idx_class_packs_studio on public.class_packs (studio_id);

-- RLS on, no policies — service-role-only access, matching 0001_init.sql.
alter table public.class_packs enable row level security;
