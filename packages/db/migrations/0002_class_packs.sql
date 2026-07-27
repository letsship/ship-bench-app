-- Class packs (prepaid class credits). A member buys a pack of credits and
-- each booking spends one until the pack runs out. Mirrors the conventions in
-- 0001_init.sql: uuid pk, timestamptz, RLS enabled with no policies (service
-- role only).

create table public.class_packs (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id),
  credits_total     integer not null check (credits_total > 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null,
  created_at        timestamptz not null default now()
);

create index idx_class_packs_member on public.class_packs (member_id);
create index idx_class_packs_studio on public.class_packs (studio_id);

alter table public.class_packs enable row level security;
