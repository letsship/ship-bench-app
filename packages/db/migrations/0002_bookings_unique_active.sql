-- Prevent a member from holding more than one active booking (booked,
-- waitlisted, or attended) for the same class session. Closes the race where
-- a double-submit on a full class's join button landed two waitlist rows for
-- the same member. Cancelled / no-show rows are excluded so a member can
-- still rebook the same session after cancelling.
create unique index bookings_active_session_member_key
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
