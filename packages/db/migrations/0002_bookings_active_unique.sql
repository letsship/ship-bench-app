-- Guard against a member landing on the same session's booking list twice.
-- A double-submit (e.g. a slow UI + a second click) must not create two
-- active rows for the same (session_id, member_id): a confirmed seat already
-- rejects this in the domain rule, but a waitlist entry did not, letting a
-- repeat submit add a second waitlist row that later gets treated as a
-- separate seat. Cancelled rows are excluded so re-booking after a
-- cancellation still works (mirrors the member-level unique(studio_id, email)
-- guard in 0001_init.sql).
create unique index bookings_active_session_member_key
  on public.bookings (session_id, member_id)
  where (status <> 'cancelled');
