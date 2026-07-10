// The provider-agnostic analytics contract. Booking services depend only on
// this interface; concrete vendors (today: PostHog) implement it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface AnalyticsEvent {
  distinctId: string;
  event: AnalyticsEventName;
  properties: { session_id: string };
}

export interface AnalyticsTracker {
  capture(event: AnalyticsEvent): Promise<void>;
}
