-- One active booking per member per class session.
--
-- A member who double-clicked `join` on a full class could land on the waitlist
-- twice: the booking service checked "does this member already have a booking?"
-- and then inserted, so two near-simultaneous submits both passed the check and
-- both inserted. The check is now backed by a database invariant, which is the
-- only place a check-then-insert race can actually be settled.
--
-- The covered statuses mirror ACTIVE_MEMBER_BOOKING_STATUSES in
-- apps/web/lib/domain/booking-rules.ts (and the guard in
-- apps/web/lib/db/repos/fakes.ts). 'cancelled' and 'no_show' are deliberately
-- excluded so a member whose booking was cancelled can book the class again.
-- If that set ever changes, this literal must be updated by hand.

-- Retire pre-existing duplicates first, otherwise the index cannot be created.
-- Keep the earliest active row per (session_id, member_id) — that is the entry
-- the member actually intended, and the one waitlist promotion would pick — and
-- cancel the surplus so it stops holding a place in the queue.
update public.bookings
set status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, now())
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by session_id, member_id
        order by booked_at, id
      ) as dup_rank
    from public.bookings
    where status in ('booked', 'waitlisted', 'attended')
  ) as ranked
  where dup_rank > 1
);

create unique index idx_bookings_one_active_per_member
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
