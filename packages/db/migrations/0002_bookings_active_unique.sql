-- Guarantee at most one active (non-cancelled) booking per member per
-- session. This is the atomic source of truth that closes the double-submit
-- race in createBooking: two concurrent inserts cannot both pass, the second
-- raises a Postgres unique-violation (sqlstate 23505) which the Supabase
-- repository maps to DuplicateActiveBookingError. Cancelled rows are excluded
-- so a member may rebook a class they previously cancelled.
create unique index bookings_session_member_active_unique
  on public.bookings (session_id, member_id)
  where status <> 'cancelled';
