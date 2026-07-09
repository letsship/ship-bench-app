-- A member may hold at most one active (booked/waitlisted/attended) booking
-- per class session. Enforced as a partial unique index so double-submits —
-- including two concurrent requests racing past the app-level check — are
-- rejected atomically by Postgres instead of relying on a read-then-write
-- check that can't see uncommitted concurrent writes.
create unique index idx_bookings_one_active_per_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
