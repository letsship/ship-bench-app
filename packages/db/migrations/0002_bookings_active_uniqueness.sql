-- Prevent a member from holding more than one active booking row (confirmed,
-- waitlisted, or attended) for the same class session. A double submit (e.g. a
-- member clicking "book" twice on a full class) previously slipped through
-- because the app-level check reads existing bookings and inserts in two
-- separate steps, with nothing in the database stopping both reads from
-- observing "no existing booking" before either insert lands. Cancelled rows
-- are excluded so a member can always rebook after cancelling.
create unique index bookings_active_member_session_key
  on public.bookings (session_id, member_id)
  where status in ('booked', 'waitlisted', 'attended');
