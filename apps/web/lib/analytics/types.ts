// The tracker-agnostic analytics contract. Service and domain code depend only
// on this interface; concrete implementations (PostHog, fake) implement it.

export type AnalyticsEvent = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const ANALYTICS_EVENTS: readonly AnalyticsEvent[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface CaptureEvent {
  distinctId: string;
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): Promise<void>;
}
