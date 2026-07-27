// The provider-agnostic analytics contract. Service and domain code depend
// only on this interface; concrete vendors (today: PostHog) implement it.

export type EventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const EVENT_NAMES: readonly EventName[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface AnalyticsEvent {
  event: EventName;
  distinctId: string;
  properties: Record<string, string | number | boolean>;
}

export interface Tracker {
  capture(event: AnalyticsEvent): Promise<void>;
}
