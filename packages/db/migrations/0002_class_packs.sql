-- Class packs: prepaid credit bundles. A member buys a pack of 5 or 10
-- credits; each booking they make spends one until the pack runs out. A
-- refunded pack has its remaining credits voided and is never drawn from.

create table public.packages (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id),
  credits_total     integer not null check (credits_total >= 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  price_cents       integer not null check (price_cents >= 0),
  status            text not null default 'active',
  purchased_at      timestamptz not null,
  created_at        timestamptz not null default now()
);

create index idx_packages_member on public.packages (member_id);

-- RLS on with no policies, like every other table: only the service role
-- (used server-side by the repositories) can read or write.
alter table public.packages enable row level security;
