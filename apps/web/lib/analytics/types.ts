// The provider-agnostic analytics contract. The booking, waitlist, and
// cancellation flows depend only on this interface; concrete vendors (today:
// PostHog) implement it. Mirrors the notification provider contract — service
// and domain code never import a `posthog` package directly.

export type AnalyticsEvent =
  | "booking_created"
  | "waitlist_joined"
  | "booking_cancelled";

export const BOOKING_CREATED_EVENT = "booking_created";
export const WAITLIST_JOINED_EVENT = "waitlist_joined";
export const BOOKING_CANCELLED_EVENT = "booking_cancelled";

export interface TrackedEvent {
  event: string;
  // The analytics distinct id. Always the member's id — never email/name/phone.
  distinctId: string;
  // Non-identifying context only (e.g. the class session id). No PII.
  properties?: Record<string, unknown>;
}

export interface Tracker {
  readonly name: string;
  capture(event: TrackedEvent): Promise<void>;
}
