// The provider-agnostic analytics contract. The booking/waitlist/cancellation
// flows depend only on this interface; concrete vendors (today: PostHog)
// implement it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface AnalyticsCaptureEvent {
  event: AnalyticsEventName;
  // The member this event is attributed to — never PII (email/name/phone).
  distinctId: string;
  properties: Record<string, unknown>;
}

export interface AnalyticsTracker {
  capture(event: AnalyticsCaptureEvent): Promise<void>;
}
