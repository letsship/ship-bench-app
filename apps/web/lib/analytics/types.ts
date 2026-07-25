// The provider-agnostic analytics contract. Service and domain code depend only
// on this interface; concrete vendors (today: PostHog) implement it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface AnalyticsEvent {
  distinctId: string;
  event: AnalyticsEventName;
  properties?: Record<string, unknown>;
}

export interface AnalyticsTracker {
  capture(event: AnalyticsEvent): void;
}
