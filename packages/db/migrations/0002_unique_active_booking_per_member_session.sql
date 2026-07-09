-- A member double-submitting a booking for the same session (e.g. clicking
-- "join" twice on a full class before the first request lands) must not be
-- able to end up with two active rows for that session. The app-level check
-- reads-then-inserts, so two near-simultaneous requests can both pass the
-- check before either insert lands; this partial unique index closes that
-- race by rejecting the second insert at the database level. Cancelled rows
-- are excluded so a member can always rebook after cancelling.
create unique index idx_bookings_unique_active_per_member_session
  on public.bookings (session_id, member_id)
  where status <> 'cancelled';
