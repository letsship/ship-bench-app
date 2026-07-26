// The provider-agnostic analytics contract. Booking flows and the route
// handlers depend only on this interface; the concrete vendor (today:
// PostHog) implements it.

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

export interface AnalyticsTracker {
  capture(event: CaptureEvent): void | Promise<void>;
}
