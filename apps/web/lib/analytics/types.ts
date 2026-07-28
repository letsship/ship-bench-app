// The provider-agnostic analytics contract. Services depend only on this
// interface; concrete vendors (today: PostHog) implement it.

export const BOOKING_CREATED = "booking_created";
export const WAITLIST_JOINED = "waitlist_joined";
export const BOOKING_CANCELLED = "booking_cancelled";

export const ANALYTICS_EVENT_NAMES = [
  BOOKING_CREATED,
  WAITLIST_JOINED,
  BOOKING_CANCELLED,
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export interface AnalyticsEvent {
  event: AnalyticsEventName | string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export interface Tracker {
  readonly name: string;
  capture(event: AnalyticsEvent): void | Promise<void>;
}