-- =============================================================
-- ACTIVE BOOKING UNIQUENESS
-- =============================================================

-- Keep the earliest active booking and cancel any existing duplicates before
-- adding the constraint. This preserves booking history and makes the migration
-- deployable against studios that already encountered the double-submit race.
with ranked_active_bookings as (
  select
    id,
    row_number() over (
      partition by session_id, member_id
      order by booked_at, id
    ) as duplicate_number
  from public.bookings
  where status in ('booked', 'waitlisted', 'attended')
)
update public.bookings as bookings
set
  status = 'cancelled',
  cancelled_at = coalesce(bookings.cancelled_at, now())
from ranked_active_bookings
where bookings.id = ranked_active_bookings.id
  and ranked_active_bookings.duplicate_number > 1;

-- Cancelled and no-show rows remain reusable history, so those members can book
-- the same class session again. Keep this status list in sync with
-- ACTIVE_MEMBER_BOOKING_STATUSES in apps/web/lib/domain/booking-rules.ts.
create unique index idx_bookings_unique_active_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
