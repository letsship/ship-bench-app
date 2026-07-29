-- Class packs: prepaid credit bundles for members to draw from when booking.

-- =============================================================
-- CLASS PACKS
-- =============================================================
create table public.class_packs (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id) on delete cascade,
  credits           integer not null default 1 check (credits >= 1),
  credits_remaining integer not null default 1 check (credits_remaining >= 0),
  price_cents       integer not null default 0 check (price_cents >= 0),
  status            text not null default 'active',
  created_at        timestamptz not null default now()
);

create index idx_class_packs_member on public.class_packs (member_id);

alter table public.class_packs enable row level security;
