-- Prevent double-booking: a member can have at most one active booking per session.
-- This partial index covers active statuses (booked, waitlisted, attended) but
-- excludes cancelled and no_show rows, so a member can re-book a cancelled class.

create unique index idx_bookings_unique_active
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
