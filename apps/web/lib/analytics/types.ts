// The provider-agnostic analytics contract. Services depend only on this
// interface; the concrete vendor (today: PostHog) implements it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface CaptureEvent {
  event: AnalyticsEventName;
  distinctId: string;
  properties: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): Promise<void>;
}
