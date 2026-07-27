-- =============================================================
-- 24-hour class reminders: per-studio opt-out setting + outbox idempotency key
-- =============================================================

alter table public.studio_settings
  add column notify_booking_reminders boolean not null default true;

alter table public.notification_outbox
  add column dedupe_key text;

create index idx_notification_outbox_dedupe on public.notification_outbox (dedupe_key);
