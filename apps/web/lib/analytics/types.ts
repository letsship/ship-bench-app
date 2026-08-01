// The provider-agnostic analytics contract. Services and route handlers depend
// only on this interface; concrete vendors (today: PostHog) implement it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  // The member the event is attributed to (the member id — never email/name/phone).
  distinctId: string;
  properties: Record<string, unknown>;
}

export interface Tracker {
  readonly name: string;
  capture(event: AnalyticsEvent): Promise<void>;
}
