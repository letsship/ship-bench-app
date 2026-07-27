-- Ensure one active booking per member+session.
-- A partial unique index on (session_id, member_id) for active statuses prevents
-- concurrent double-submit from creating duplicate waitlist entries.
-- The WHERE clause excludes cancelled (and no_show) so a member can re-book after cancelling.
create unique index bookings_one_active_per_member on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
