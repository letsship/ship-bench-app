// The provider-agnostic analytics contract. The booking service depends only
// on this interface; concrete vendors (today: PostHog) implement it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  // The analytics distinct id — always the member's id, never PII.
  distinctId: string;
  properties: Record<string, unknown>;
}

export interface Tracker {
  capture(event: AnalyticsEvent): Promise<void> | void;
}
