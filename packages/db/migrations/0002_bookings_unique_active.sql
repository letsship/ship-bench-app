-- A member must hold at most one active (non-cancelled) booking per session.
-- `canBook` already rejects a *sequential* repeat, but the read-decide-insert
-- sequence in `createBooking` is not atomic: two overlapping requests (the
-- double-click on an unresponsive button) both read before either writes, both
-- pass the check, and both insert. This partial unique index closes that race
-- at the database — the second insert is rejected by Postgres with a
-- unique_violation (23505), which the Supabase repository maps back to the
-- existing "already booked" conflict. A `where status <> 'cancelled'` predicate
-- keeps today's behaviour intact: a cancelled booking does not block a fresh
-- booking for the same member + class.

-- Dedupe existing active bookings first. The race this migration fixes has
-- already left members double-booked onto a full class's waitlist in
-- production; in the reported case one duplicate was later promoted to a
-- confirmed seat while the other stayed waitlisted, so both rows are active
-- and a plain CREATE UNIQUE INDEX would fail on exactly the data that
-- motivated this fix. For each (session_id, member_id) with more than one
-- active row, keep the single best row (prefer a confirmed seat, then the
-- earliest booked_at) and cancel the surplus so occupancy is corrected and
-- the index below can be created.
with ranked as (
  select
    id,
    row_number() over (
      partition by session_id, member_id
      order by
        case status when 'booked' then 0 else 1 end,
        booked_at
    ) as rn
  from public.bookings
  where status <> 'cancelled'
)
update public.bookings as b
  set status = 'cancelled',
      cancelled_at = coalesce(b.cancelled_at, now())
from ranked
where ranked.id = b.id
  and ranked.rn > 1;

create unique index bookings_session_member_active_unique
  on public.bookings (session_id, member_id)
  where status <> 'cancelled';
