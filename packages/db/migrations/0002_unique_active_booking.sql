-- A member can hold at most one ACTIVE (booked or waitlisted) row per session.
-- Cancelled rows are excluded so rebooking after a cancellation is unaffected.
-- This is a defense-in-depth backstop for the app-level check in canBook():
-- two requests racing past that check (e.g. a double-click) both pass it
-- before either has written a row, so only a DB-level constraint reliably
-- rejects the second insert.
create unique index bookings_one_active_per_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted');
