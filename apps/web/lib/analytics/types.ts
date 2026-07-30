// The provider-agnostic analytics contract. The booking services and domain
// code depend only on this interface; the concrete vendor (today: PostHog via
// posthog-node) is constructed only at the composition root, the same way email
// routes through `lib/notifications`. No `posthog` package is imported here.

export type AnalyticsEvent =
  | "booking_created"
  | "waitlist_joined"
  | "booking_cancelled";

export interface CaptureEvent {
  event: AnalyticsEvent;
  // The member's id — the analytics distinct id. Never an email or name.
  distinctId: string;
  // Non-identifying context only (e.g. the class session id). No PII.
  properties?: Record<string, unknown>;
}

export interface Tracker {
  readonly name: string;
  capture(event: CaptureEvent): void | Promise<void>;
}
