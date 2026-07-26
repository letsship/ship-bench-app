-- Add the studio-level opt-out flag for 24-hour class reminders.
alter table public.studio_settings
  add column notify_booking_reminders boolean not null default true;
