-- Enforce at most one active booking per member per session.
-- Active statuses (booked, waitlisted, attended) cannot have duplicates;
-- cancelled and no_show rows do not block re-booking.
create unique index uniq_active_booking_per_member on public.bookings (session_id, member_id) where status in ('booked', 'waitlisted', 'attended');
