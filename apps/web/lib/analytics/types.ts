// The provider-agnostic analytics contract. Service and domain code depend only
// on this interface; concrete vendors (today: PostHog) implement it.

export const BOOKING_CREATED = "booking_created";
export const WAITLIST_JOINED = "waitlist_joined";
export const BOOKING_CANCELLED = "booking_cancelled";

export type EventName = typeof BOOKING_CREATED | typeof WAITLIST_JOINED | typeof BOOKING_CANCELLED;

export interface CaptureEvent {
  event: EventName;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsTracker {
  capture(event: CaptureEvent): Promise<void>;
  shutdown?(): Promise<void>;
}
