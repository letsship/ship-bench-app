-- Add dedupe_key column to notification_outbox for idempotent reminder sends.
-- Add notify_reminders column to studio_settings to control booking reminders.

alter table public.notification_outbox
add column dedupe_key text;

create unique index idx_notification_outbox_dedupe
on public.notification_outbox (dedupe_key)
where dedupe_key is not null;

alter table public.studio_settings
add column notify_reminders boolean not null default true;
