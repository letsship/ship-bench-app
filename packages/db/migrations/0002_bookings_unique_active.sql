-- Prevent double-booking: a member can have at most one active booking per session.
-- This partial index covers active statuses (booked, waitlisted, attended) but
-- excludes cancelled and no_show rows, so a member can re-book a cancelled class.

-- First, clean up any existing duplicate active bookings (same member+session).
-- Keep the earliest booked_at per group, delete the rest.
-- This is necessary because the unique index will fail if duplicates exist.
delete from public.bookings
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by session_id, member_id
        order by booked_at asc
      ) as rn
    from public.bookings
    where status in ('booked', 'waitlisted', 'attended')
  ) duplicates
  where rn > 1
);

-- Now create the unique index. CONCURRENTLY avoids holding an exclusive lock
-- on the bookings table during index creation on large datasets.
create unique index concurrently idx_bookings_unique_active
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
