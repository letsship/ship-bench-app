create unique index bookings_active_session_member_unique
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
