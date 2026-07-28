-- Data cleanup: before adding the UNIQUE index, collapse any duplicate active
-- (session_id, member_id) groups down to one row so the index can be created
-- without violating its constraint. Production data may contain duplicates from
-- the TOCTOU race this migration fixes (e.g. one waitlisted entry plus the same
-- member's entry that was later promoted to 'booked' when a seat opened up).
--
-- Strategy per (session_id, member_id) group with >1 active row:
--   - If exactly one row is 'booked', keep that row and cancel all surplus
--     'waitlisted' rows.
--   - Otherwise keep the earliest row (lowest booked_at) and cancel the rest.
--
-- The cancellations are real — the surplus rows never should have been created,
-- so correcting the data means removing their active status. 'cancelled' rows
-- are excluded from the partial index, so this makes the duplicates invisible
-- to the constraint.

with dupes as (
  select
    id,
    session_id,
    member_id,
    status,
    booked_at,
    count(*) over (partition by session_id, member_id) as cnt,
    row_number() over (
      partition by session_id, member_id
      order by
        -- prefer a 'booked' row over 'waitlisted' so we keep the confirmed seat
        case status when 'booked' then 0 when 'waitlisted' then 1 else 2 end,
        booked_at asc
    ) as rn
  from public.bookings
  where status in ('booked', 'waitlisted', 'attended')
)
update public.bookings
set
  status = 'cancelled',
  cancelled_at = now()
from dupes
where
  dupes.cnt > 1
  and dupes.rn > 1
  and dupes.id = bookings.id;

-- Partial UNIQUE index on bookings(session_id, member_id) restricted to active
-- statuses (booked, waitlisted, attended). This rejects a second active booking
-- row for the same member + session atomically at the database level, closing
-- the TOCTOU race between two near-simultaneous 'join' clicks.
-- Cancelled (and no_show) rows are excluded so a member whose booking was
-- cancelled can rebook the same session.
create unique index idx_bookings_active_unique
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');