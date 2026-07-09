// The provider-agnostic analytics contract. Booking/waitlist/cancellation
// flows depend only on this interface; concrete vendors (today: PostHog)
// implement it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  distinctId: string;
  // No PII (email, name, phone, ...) belongs in here — only opaque ids.
  properties: Record<string, unknown>;
}

export interface AnalyticsTracker {
  readonly name: string;
  capture(event: AnalyticsEvent): Promise<void> | void;
}
