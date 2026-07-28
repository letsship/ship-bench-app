-- Partial UNIQUE index on bookings(session_id, member_id) restricted to active
-- statuses (booked, waitlisted, attended). This rejects a second active booking
-- row for the same member + session atomically at the database level, closing
-- the TOCTOU race between two near-simultaneous 'join' clicks.
-- Cancelled (and no_show) rows are excluded so a member whose booking was
-- cancelled can rebook the same session.
create unique index idx_bookings_active_unique
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');