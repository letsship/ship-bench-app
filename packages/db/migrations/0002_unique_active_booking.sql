-- A member may have at most one active (booked / waitlisted / attended)
-- booking per class session. This is the atomic guard behind the app-level
-- `canBook` pre-check: without it, two concurrent double-submits can both
-- pass the pre-check before either row is inserted, landing the same member
-- on a session's waitlist twice. Cancelled rows are excluded so a member can
-- always re-book a session after cancelling.
create unique index idx_bookings_one_active_per_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
