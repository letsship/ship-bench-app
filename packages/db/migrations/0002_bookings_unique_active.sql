-- One active booking per member per class session. Cancelled rows sit outside the
-- index, so a member can rebook a class after cancelling.

-- Collapse existing duplicates before the index can be created: the earliest active
-- row per (session, member) is kept, every later one is cancelled.
with ranked as (
  select id,
         row_number() over (partition by session_id, member_id order by booked_at, id) as rn
  from public.bookings
  where status in ('booked', 'waitlisted', 'attended')
)
update public.bookings as b
set status = 'cancelled', cancelled_at = now()
from ranked r
where r.id = b.id and r.rn > 1;

create unique index uq_bookings_active_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
