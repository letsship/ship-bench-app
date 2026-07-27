-- Guard against a member ending up with two active bookings (booked,
-- waitlisted, or attended) for the same class session. Without this, a
-- double-submit on a full class (e.g. an unresponsive "join" button clicked
-- twice) can insert two waitlist rows for the same member before either
-- insert is visible to the other's read, since the application-level check in
-- createBooking is a read-then-write, not atomic.
--
-- Existing duplicates must be resolved before the index can be created: for
-- each (session_id, member_id) pair with more than one active row, keep the
-- earliest-booked row and cancel the rest.
with ranked as (
  select
    id,
    row_number() over (
      partition by session_id, member_id
      order by booked_at asc
    ) as rn
  from public.bookings
  where status in ('booked', 'waitlisted', 'attended')
)
update public.bookings
set status = 'cancelled', cancelled_at = now()
where id in (select id from ranked where rn > 1);

create unique index uniq_bookings_active_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
