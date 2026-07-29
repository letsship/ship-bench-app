-- Enforce one active booking per member per class at the database level.
-- Active statuses are booked, waitlisted, and attended — a member cannot hold
-- two seats or occupy two waitlist spots on the same session. Cancelled and
-- no_show rows are excluded so a member can rebook after cancelling.
-- This also closes the check-then-insert race that let double-clicks produce
-- duplicate waitlist entries.
create unique index idx_bookings_unique_active_booking
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');