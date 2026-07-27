// The provider-agnostic analytics contract. Services depend only on this
// interface; the concrete vendor (today: PostHog) implements it.

export type AnalyticsEvent = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface CaptureEvent {
  distinctId: string;
  event: AnalyticsEvent;
  // No email, name, or phone number belongs here — distinctId already
  // identifies the member.
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): void;
  // Flush any queued events. Optional: the recording tracker has nothing to flush.
  shutdown?(): Promise<void>;
}
