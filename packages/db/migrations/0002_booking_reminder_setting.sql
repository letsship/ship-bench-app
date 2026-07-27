alter table public.studio_settings add column if not exists notify_booking_reminders boolean not null default true;
