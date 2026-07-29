// The provider-agnostic analytics contract. The tracker and event builders
// depend only on this interface; concrete vendors (today: PostHog) implement it.

export type AnalyticsEvent = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface CaptureEvent {
  event: AnalyticsEvent;
  distinctId: string;
  properties: Record<string, unknown>;
}

export interface Tracker {
  readonly name: string;
  capture(event: CaptureEvent): Promise<void>;
}