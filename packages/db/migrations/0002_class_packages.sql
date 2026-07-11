-- Prepaid class packs: a member buys a bundle of credits and bookings draw
-- from it automatically. Follows the same conventions as 0001_init.sql — app
-- generated uuid primary keys, timestamptz written/read as ISO-8601 UTC, RLS
-- enabled with no policies (service role only).

-- =============================================================
-- CLASS PACKAGES
-- =============================================================
create table public.class_packages (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id),
  credits_total     integer not null check (credits_total >= 1),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null default 0 check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null default now()
);

create index idx_class_packages_member on public.class_packages (member_id);

alter table public.class_packages enable row level security;
