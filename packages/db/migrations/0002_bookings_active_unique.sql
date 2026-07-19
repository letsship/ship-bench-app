-- Add partial unique index to prevent duplicate active bookings for the same member + session.
-- This prevents a member from booking the same session twice by double-clicking,
-- since the race window between check and insert is closed at the database level.
-- Cancelled and no_show entries are excluded so a cancelled member can rebook.

create unique index idx_bookings_active_unique on public.bookings (session_id, member_id)
where status in ('booked', 'waitlisted', 'attended');
