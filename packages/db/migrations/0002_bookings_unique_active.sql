-- One active booking per member per class session.
--
-- createBooking checks for an existing active booking before inserting, but
-- the check and the insert are two separate statements, so a double submit
-- (e.g. an unresponsive "join" button clicked twice) can pass the check in
-- both requests and insert two rows — leaving a member twice on a waitlist.
-- This partial unique index enforces the rule atomically at the database:
-- the second concurrent insert fails with a unique violation, which the app
-- maps to the same 409 "already has a booking" conflict.
--
-- Cancelled and no_show rows are excluded so a member whose booking was
-- cancelled can book the same class again.

create unique index bookings_unique_active_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
