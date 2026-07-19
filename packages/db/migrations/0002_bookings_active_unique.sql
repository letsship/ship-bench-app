-- Prevent double-booking by enforcing at most one active booking per member per session.
-- A partial unique index ensures concurrent submits can never create a second active row,
-- while allowing a member to re-book after cancelling (status = 'cancelled' rows are excluded).

create unique index idx_bookings_active_unique on public.bookings (session_id, member_id)
  where status <> 'cancelled';
