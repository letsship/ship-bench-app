-- Enforce "one active booking per member per class session" at the database.
--
-- A double-submit (e.g. an unresponsive "join" button clicked twice) can race
-- the application-level pre-check in createBooking: both requests read the
-- bookings list before either insert commits, both pass, and both insert a
-- row. A partial unique index makes the invariant atomic.

-- De-duplicate pre-existing active duplicates first (e.g. members already
-- showing up twice on a waitlist) or the CREATE UNIQUE INDEX below will fail.
-- Keep the earliest-booked active row per (session_id, member_id) and cancel
-- the rest.
update public.bookings b
set status = 'cancelled',
    cancelled_at = now()
where b.status in ('booked', 'waitlisted', 'attended')
  and exists (
    select 1
    from public.bookings earlier
    where earlier.session_id = b.session_id
      and earlier.member_id = b.member_id
      and earlier.status in ('booked', 'waitlisted', 'attended')
      and (earlier.booked_at, earlier.id) < (b.booked_at, b.id)
  );

-- Partial unique index: only active rows participate, so cancelled / no_show
-- history never blocks a member from booking the same class again.
create unique index bookings_one_active_per_member
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
