// The provider-agnostic analytics contract. Services depend only on this
// interface; the concrete vendor (today: PostHog) implements it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface AnalyticsEvent {
  distinctId: string;
  event: AnalyticsEventName;
  properties: Record<string, unknown>;
}

export interface Tracker {
  readonly name: string;
  capture(event: AnalyticsEvent): void | Promise<void>;
}
