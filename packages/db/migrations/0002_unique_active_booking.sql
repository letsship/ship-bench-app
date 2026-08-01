-- Prevent duplicate active bookings for the same member + class session.
-- Cancelled and no-show rows remain reusable history, so those members can book
-- the same class session again.

create unique index idx_bookings_unique_active_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
