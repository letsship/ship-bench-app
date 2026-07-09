-- Prepaid class packs: a member buys a bundle of credits and each booking
-- spends one, oldest pack first. Row Level Security is enabled with no
-- policies, matching every table in 0001_init.sql.

-- =============================================================
-- CLASS PACKAGES
-- =============================================================
create table public.class_packages (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.members(id) on delete cascade,
  credits_total     integer not null check (credits_total >= 1),
  credits_remaining integer not null default 0 check (credits_remaining >= 0),
  price_cents       integer not null default 0 check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null default now()
);

create index idx_class_packages_member on public.class_packages (member_id);

alter table public.class_packages enable row level security;
