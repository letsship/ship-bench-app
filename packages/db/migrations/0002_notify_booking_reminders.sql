-- Studiobook migration 0002: 24-hour class reminders.
-- Adds the studio-level toggle gating booking_reminder notifications, mirroring
-- the other notify_* columns from 0001_init. Default true keeps reminders on
-- for existing studios unless explicitly disabled.

alter table public.studio_settings
  add column notify_booking_reminders boolean not null default true;
