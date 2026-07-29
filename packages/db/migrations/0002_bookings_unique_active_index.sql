-- A member used to be able to land on a class waitlist twice by double-submitting
-- the join button: `createBooking` reads `listBySession`, runs `canBook`, then
-- inserts, with no atomicity, and the `bookings` table only had plain indexes.
-- Two near-simultaneous submits both passed the in-memory check and both inserted.
--
-- This migration adds a PARTIAL unique index so that, at the database level, a
-- member can hold at most one *active* booking (booked / waitlisted / attended /
-- no_show) per session. Cancelled rows are excluded so a member whose booking was
-- cancelled can book the same class again. The service layer maps a violation of
-- this index back to the existing "already has a booking" 409 conflict.

create unique index ux_bookings_session_member_active
  on public.bookings (session_id, member_id)
  where status <> 'cancelled';
