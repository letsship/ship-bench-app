-- Enforce at most one active booking per (member, session).
-- Active = booked | waitlisted | attended; cancelled/no_show entries don't block rebooks.
create unique index idx_bookings_unique_active_per_session on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
