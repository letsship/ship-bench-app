-- Prevent a member from holding more than one active (booked / waitlisted /
-- attended) booking for the same session. Without this, two near-simultaneous
-- booking requests can both read "no existing booking" before either commits,
-- letting a double-click on "join" land the member on a waitlist twice.
-- `cancelled` rows are excluded so cancelling and rebooking still works.
create unique index bookings_unique_active_per_member
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
