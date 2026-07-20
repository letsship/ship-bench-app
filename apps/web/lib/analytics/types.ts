// The provider-agnostic analytics contract. Service and domain code depend only
// on this interface; the real PostHog client is constructed at the composition root.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface CaptureEvent {
  event: AnalyticsEventName;
  distinctId: string;
  properties: {
    session_id: string;
  };
}

export interface Tracker {
  capture(event: CaptureEvent): void;
}
