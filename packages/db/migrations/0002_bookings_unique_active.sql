with ranked_active_bookings as (
  select
    id,
    row_number() over (
      partition by session_id, member_id
      order by booked_at asc, id asc
    ) as booking_rank
  from public.bookings
  where status in ('booked', 'waitlisted', 'attended')
)
update public.bookings as bookings
set status = 'cancelled', cancelled_at = now()
from ranked_active_bookings
where bookings.id = ranked_active_bookings.id
  and ranked_active_bookings.booking_rank > 1;

create unique index idx_bookings_active_member_unique
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
