export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const ANALYTICS_EVENTS: readonly AnalyticsEventName[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsTracker {
  capture(event: AnalyticsEvent): void | Promise<void>;
}
