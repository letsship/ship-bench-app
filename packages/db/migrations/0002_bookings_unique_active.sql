-- Add partial unique index on bookings to prevent duplicate active bookings
-- for the same member+session combination (waitlisted, booked, or attended).
-- Cancelled and no_show bookings do not trigger the constraint, so members
-- can rebook after cancellation.
create unique index bookings_one_active_per_member on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
