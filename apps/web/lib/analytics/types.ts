// The analytics provider-agnostic contract. Services depend only on this
// interface; concrete vendors (today: PostHog) implement it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: AnalyticsEvent): Promise<void>;
}
