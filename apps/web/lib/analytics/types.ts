// The vendor-agnostic analytics contract. Services capture funnel events
// through this interface; concrete vendors (today: PostHog) implement it.
// Nothing outside lib/analytics/ references a vendor SDK directly.

export const BOOKING_CREATED = "booking_created";
export const WAITLIST_JOINED = "waitlist_joined";
export const BOOKING_CANCELLED = "booking_cancelled";

export type AnalyticsEventName =
  typeof BOOKING_CREATED | typeof WAITLIST_JOINED | typeof BOOKING_CANCELLED;

// Mirrors the shape of posthog-node's capture call. Properties must stay free
// of personal data (no email, name, or phone) — events carry ids only.
export interface CaptureEvent {
  distinctId: string;
  event: AnalyticsEventName;
  properties?: Record<string, string | number | boolean>;
}

export interface AnalyticsTracker {
  readonly name: string;
  capture(event: CaptureEvent): Promise<void>;
}
