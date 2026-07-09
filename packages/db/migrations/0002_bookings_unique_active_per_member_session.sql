-- A member may hold at most one active (non-cancelled) booking per session.
-- Without this, two near-simultaneous booking attempts for the same member +
-- session can both read "no existing booking" before either write lands,
-- producing duplicate waitlist rows (or a duplicate confirmed seat). Cancelled
-- rows are excluded so a member can always re-book after cancelling.
create unique index bookings_one_active_per_member_session
  on public.bookings (member_id, session_id)
  where status in ('booked', 'waitlisted', 'attended');
