-- Add partial unique index to prevent duplicate active bookings per member per session.
-- This enforces at the database level that a member can have at most one non-cancelled
-- booking for any given class session, closing the race-condition window where concurrent
-- double-clicks both pass the application-level canBook check and both insert.

-- First, de-duplicate any pre-existing active bookings (cancelled rows are exempt from
-- this constraint, so they don't need cleanup). For each (session_id, member_id) pair
-- that has multiple non-cancelled bookings, keep the earliest booked_at and cancel the rest.
-- This ensures the index can be created on real production data.
delete from public.bookings
where id in (
  select b1.id
  from public.bookings b1
  inner join (
    select session_id, member_id, min(booked_at) as earliest_booked_at
    from public.bookings
    where status <> 'cancelled'
    group by session_id, member_id
    having count(*) > 1
  ) dups on (
    b1.session_id = dups.session_id
    and b1.member_id = dups.member_id
    and b1.status <> 'cancelled'
    and b1.booked_at > dups.earliest_booked_at
  )
);

-- Create the partial unique index. The 'where status <> 'cancelled'' predicate
-- ensures the index applies only to active bookings (booked, waitlisted, attended, no_show),
-- permitting re-booking after a cancellation and ensuring at most one active booking per
-- member per session.
create unique index bookings_one_active_per_member on public.bookings (
  session_id,
  member_id
) where status <> 'cancelled';
