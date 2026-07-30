-- =============================================================
-- ONE ACTIVE BOOKING PER MEMBER PER SESSION
-- =============================================================
-- A double-submit on the bookings page used to create two rows for the same
-- member on the same session (most visibly two waitlist entries, one of which
-- later got promoted while the other kept holding a place in the queue).
--
-- The app guards this in `createBooking`, but a read-then-insert cannot be
-- race-free on its own: two concurrent requests can both read the session
-- before either writes. This partial unique index makes the database the
-- arbiter — the losing insert raises 23505, which the bookings repository maps
-- to the same "already has a booking" conflict a sequential duplicate returns.
--
-- The predicate mirrors BLOCKING_BOOKING_STATUSES in
-- apps/web/lib/domain/booking-rules.ts. Keep the two in sync. `cancelled` and
-- `no_show` are deliberately excluded so a member can re-book a class they
-- cancelled.

create unique index if not exists uniq_active_booking_per_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
