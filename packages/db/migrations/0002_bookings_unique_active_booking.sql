-- Add a partial unique constraint on active bookings (session_id, member_id).
-- This prevents a member from holding multiple active bookings for the same class,
-- closing the double-submit race window at the storage layer.
--
-- The index covers only the active statuses (booked, waitlisted, attended),
-- excluding cancelled and no_show to match the ACTIVE_MEMBER_BOOKING set in
-- apps/web/lib/domain/booking-rules.ts, so a cancelled member can rebook.

create unique index idx_bookings_unique_active on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
