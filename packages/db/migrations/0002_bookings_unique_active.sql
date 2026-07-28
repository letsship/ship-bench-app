-- A member must hold at most one active (non-cancelled) booking per session.
-- `canBook` already rejects a *sequential* repeat, but the read-decide-insert
-- sequence in `createBooking` is not atomic: two overlapping requests (the
-- double-click on an unresponsive button) both read before either writes, both
-- pass the check, and both insert. This partial unique index closes that race
-- at the database — the second insert is rejected by Postgres with a
-- unique_violation (23505), which the Supabase repository maps back to the
-- existing "already booked" conflict. A `where status <> 'cancelled'` predicate
-- keeps today's behaviour intact: a cancelled booking does not block a fresh
-- booking for the same member + class.
create unique index bookings_session_member_active_unique
  on public.bookings (session_id, member_id)
  where status <> 'cancelled';
