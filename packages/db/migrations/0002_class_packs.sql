-- =============================================================
-- CLASS PACKS — prepaid bundles of class credits. A member buys a pack and
-- every confirmed booking spends one credit until the pack runs out. Scoped by
-- member (like bookings), which already carries the studio.
-- =============================================================
create table public.class_packs (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.members(id) on delete cascade,
  credits_total     integer not null check (credits_total > 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null default 0,
  status            text not null default 'active',
  purchased_at      timestamptz not null default now()
);

create index idx_class_packs_member on public.class_packs (member_id);

-- RLS on with no policies, matching every sibling table: the app reads and
-- writes exclusively through the service role, which bypasses RLS.
alter table public.class_packs enable row level security;
