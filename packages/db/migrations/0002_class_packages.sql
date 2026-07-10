-- Prepaid class packs (credit bundles): a member buys a pack of credits and
-- each booking spends one, oldest pack first, until it runs out.

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
