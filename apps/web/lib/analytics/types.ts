export const BOOKING_CREATED = "booking_created";
export const WAITLIST_JOINED = "waitlist_joined";
export const BOOKING_CANCELLED = "booking_cancelled";

export interface AnalyticsEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: AnalyticsEvent): void;
}
