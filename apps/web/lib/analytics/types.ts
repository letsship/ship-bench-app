// The vendor-agnostic product-analytics contract. Services and domain code
// depend only on this interface; concrete vendors (today: PostHog) implement it,
// exactly as NotificationProvider does for email.

// The funnel moments the founder tracks: a booking, a waitlist join, a cancel.
export const BOOKING_CREATED = "booking_created";
export const WAITLIST_JOINED = "waitlist_joined";
export const BOOKING_CANCELLED = "booking_cancelled";

export const ANALYTICS_EVENTS: readonly string[] = [
  BOOKING_CREATED,
  WAITLIST_JOINED,
  BOOKING_CANCELLED,
];

export interface CaptureEvent {
  event: string;
  // The member's id — the analytics distinct id. Never an email, name, or phone
  // number: captured events carry identifiers only, never personal data.
  distinctId: string;
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): Promise<void> | void;
}
