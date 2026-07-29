-- Add per-member private calendar token for personal iCalendar subscriptions.
-- Tokens are generated app-side (high-entropy hex strings); existing rows get
-- a one-time gen_random_uuid() default so the column is NOT NULL immediately.

alter table public.members
  add column calendar_token text not null default gen_random_uuid()::text;

create unique index idx_members_calendar_token on public.members (calendar_token);