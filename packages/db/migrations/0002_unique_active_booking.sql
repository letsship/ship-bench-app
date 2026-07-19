-- Partial unique index on active bookings (session_id, member_id).
-- Prevents a member from holding multiple active bookings for the same class,
-- closing the race between concurrent POST requests that both read-check before either writes.
-- Excludes cancelled and no_show rows so a member can rebook after cancellation.

create unique index idx_unique_active_booking
on public.bookings (session_id, member_id)
where status in ('booked', 'waitlisted', 'attended');
