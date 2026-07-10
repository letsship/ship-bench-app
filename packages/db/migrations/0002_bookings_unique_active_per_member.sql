-- Prevent a member from holding more than one active (booked / waitlisted /
-- attended) booking for the same session. Without this, two near-simultaneous
-- booking requests can both read "no existing booking" before either commits,
-- letting a double-click on "join" land the member on a waitlist twice.
-- `cancelled` rows are excluded so cancelling and rebooking still works.
--
-- This is exactly the bug being fixed, so existing data may already contain
-- duplicate active rows for the same session_id + member_id. Cancel every
-- active row but the earliest per session+member before the index is created,
-- otherwise the `create unique index` below fails on those duplicates.
with duplicate_active_bookings as (
  select
    id,
    row_number() over (
      partition by session_id, member_id
      order by booked_at asc, id asc
    ) as rank
  from public.bookings
  where status in ('booked', 'waitlisted', 'attended')
)
update public.bookings
set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now())
where id in (select id from duplicate_active_bookings where rank > 1);

create unique index bookings_unique_active_per_member
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
