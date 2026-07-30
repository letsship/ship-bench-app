-- Automatic 24-hour class reminders.
-- Adds the studio-level toggle that gates the new `booking_reminder`
-- notification kind. Defaults on, matching the other notify_* columns, so
-- existing studios start sending reminders without a data backfill.

alter table public.studio_settings
  add column notify_class_reminders boolean not null default true;

-- The reminder job dedups by kind across every outbox row (pending or already
-- delivered), which is what makes the cron endpoint safe to call repeatedly.
create index idx_notification_outbox_kind on public.notification_outbox (kind);
