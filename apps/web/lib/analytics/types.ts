// The provider-agnostic analytics contract. Service and domain code depend
// only on this interface; concrete vendors (today: PostHog) implement it.

export type AnalyticsEvent = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const ANALYTICS_EVENTS: readonly AnalyticsEvent[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface CaptureEvent {
  event: AnalyticsEvent;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): Promise<void>;
}
