-- =============================================================
-- ONE ACTIVE BOOKING PER MEMBER PER SESSION
-- =============================================================
-- A member may hold at most one active booking (booked, waitlisted, or
-- attended) for a given class session. This partial unique index is the
-- atomic guard that closes the read-then-insert race on double submits:
-- two concurrent inserts for the same member + session cannot both land.
-- Cancelled and no_show rows are excluded so a member whose booking was
-- cancelled can book the same session again.
--
-- Must stay in sync with ACTIVE_MEMBER_BOOKING in
-- apps/web/lib/domain/booking-rules.ts and the in-memory guard in
-- apps/web/lib/db/repos/fakes.ts. The application maps violations of this
-- index to the 409 `booking_already_booked` conflict.
create unique index uniq_bookings_active_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
