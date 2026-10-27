-- 24-hour booking reminders: idempotency key on the outbox and the studio
-- toggle gating reminder notifications.

alter table public.notification_outbox add column dedup_key text;

-- One pending/queued row per dedup key, ever — the race-safe backstop behind
-- the app-level idempotency check in the reminders job.
create unique index notification_outbox_dedup_key_uniq
  on public.notification_outbox (dedup_key)
  where dedup_key is not null;

alter table public.studio_settings add column notify_reminders boolean not null default true;
