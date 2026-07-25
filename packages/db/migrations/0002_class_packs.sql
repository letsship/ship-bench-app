-- Class packs: prepaid credit bundles for class bookings.

create table public.class_packs (
  id               uuid primary key default gen_random_uuid(),
  studio_id        uuid not null references public.studios(id) on delete cascade,
  member_id        uuid not null references public.members(id),
  credits_total    integer not null check (credits_total > 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents      integer not null check (price_cents >= 0),
  status           text not null default 'active',
  purchased_at     timestamptz not null,
  created_at       timestamptz not null default now()
);

create index idx_class_packs_member on public.class_packs (member_id);

alter table public.class_packs enable row level security;
