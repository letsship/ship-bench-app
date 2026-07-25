-- Partial unique index on active bookings to enforce one active booking per member per session.
-- This closes the race condition where two concurrent inserts can both pass the application-level
-- canBook() check before either writes, resulting in duplicate active bookings (waitlisted or booked).
--
-- The index is partial: it applies only to active statuses (booked, waitlisted, attended), so
-- a member can rebook after cancelling (cancelled and no_show rows are excluded).
--
-- When a violation occurs (SQLSTATE 23505), the Supabase client surfaces error.code = '23505',
-- which the repos layer detects and throws DuplicateActiveBookingError; the service maps this to 409.

create unique index idx_bookings_unique_active_member on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
