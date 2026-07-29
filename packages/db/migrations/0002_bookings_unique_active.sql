-- Bookings: at most one ACTIVE booking per member per session.
-- "Active" mirrors isActiveBooking in apps/web/lib/domain/booking-rules.ts:
-- booked | waitlisted | attended. Cancelled and no_show rows are excluded, so
-- a member whose booking was cancelled can book the same class again.
--
-- This partial unique index is what makes BookingsRepo.insertUniqueActive
-- atomic under real concurrency: two simultaneous inserts for the same
-- session_id + member_id race, one wins, and the loser raises a 23505
-- unique-violation, which the repository maps to a 409 "already_booked"
-- conflict instead of a second waitlist/booking row.
--
-- If live data already contains duplicate active rows for a session + member
-- (the bug this migration prevents), cancel the extra rows before applying.

create unique index bookings_unique_active
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
