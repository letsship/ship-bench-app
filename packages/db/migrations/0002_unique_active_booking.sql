-- =============================================================
-- ONE ACTIVE BOOKING PER MEMBER PER SESSION
-- =============================================================
-- A member may hold at most one active booking (booked, waitlisted, or
-- attended) for a given class session. This partial unique index is the
-- atomic guard that closes the read-then-insert race on double submits:
-- two concurrent inserts for the same member + session cannot both land.
-- Cancelled and no_show rows are excluded so a member whose booking was
-- cancelled can book the same session again.
--
-- Must stay in sync with ACTIVE_MEMBER_BOOKING in
-- apps/web/lib/domain/booking-rules.ts and the in-memory guard in
-- apps/web/lib/db/repos/fakes.ts. The application maps violations of this
-- index to the 409 `booking_already_booked` conflict.

-- Dedup pre-existing duplicate active rows so the unique index can build.
-- The double-submit bug this migration guards against has already produced
-- duplicates in production (e.g. a member waitlisted twice for one session,
-- one entry later promoted to a confirmed seat). Keep the strongest booking
-- per (session_id, member_id) — attended over booked over waitlisted, then
-- earliest booked_at — and cancel the rest, freeing any waitlist spots the
-- duplicates were holding.
with ranked as (
  select
    id,
    row_number() over (
      partition by session_id, member_id
      order by
        case status
          when 'attended' then 0
          when 'booked' then 1
          else 2
        end,
        booked_at,
        id
    ) as keep_rank
  from public.bookings
  where status in ('booked', 'waitlisted', 'attended')
)
update public.bookings b
set status = 'cancelled', cancelled_at = now()
from ranked
where b.id = ranked.id
  and ranked.keep_rank > 1;

create unique index uniq_bookings_active_member_session
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
