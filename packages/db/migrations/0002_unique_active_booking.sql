-- A member may hold at most one non-cancelled booking per class session.
-- Without this constraint, two near-simultaneous POSTs to /api/bookings both
-- read the pre-insert state, both pass the domain `canBook` check, and both
-- insert a waitlist row — leaving the member on the waitlist twice (one entry
-- may even get promoted to a confirmed seat while the duplicate stays on the
-- waitlist, throwing off occupancy).
--
-- The partial unique index below makes the second concurrent insert fail at the
-- database. Cancelled rows are excluded so a member whose booking was
-- cancelled can book the same session again (re-booking after cancellation).
-- The active set mirrored by the domain (`lib/domain/booking-rules.ts`) is
-- `booked`, `waitlisted`, `attended`, `no_show` — i.e. everything but
-- `cancelled` — so the index predicate `status <> 'cancelled'` stays in lock
-- step with `canBook`.

create unique index uniq_bookings_session_member_active
  on public.bookings (session_id, member_id)
  where status <> 'cancelled';
