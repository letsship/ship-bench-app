-- A member may hold at most one active booking (booked, waitlisted, or
-- attended) per class session. This is the atomic guard that closes the
-- double-submit race the front desk hit: two near-simultaneous inserts for
-- the same member + session can no longer both succeed, even though both
-- requests read the pre-insert booking list before either write commits.
-- Cancelled and no_show rows are excluded so a member can always rebook a
-- class after cancelling.
create unique index bookings_active_member_session_key
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
