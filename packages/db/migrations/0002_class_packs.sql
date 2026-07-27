-- Class packs: prepaid credits bundled for purchase.
-- A member buys a pack of 5 or 10 credits; each booking draws one credit.
-- Refunded packs have creditsRemaining zeroed and status 'refunded' to prevent spend.

create table public.packages (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id),
  credits_total     integer not null check (credits_total > 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null default 0 check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null default now()
);

create index idx_packages_member on public.packages (member_id);

alter table public.packages enable row level security;
