// The provider-agnostic analytics contract. The booking/cancellation service
// functions and any domain-adjacent code depend only on this interface; the
// concrete vendor (today: PostHog) implements it behind the composition root in
// `tracker.ts`. Mirrors `lib/notifications/types.ts`.

export type AnalyticsEvent = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface CaptureEvent {
  // The member's id is the analytics distinct id — events are attributed to the
  // member who triggered the funnel step.
  distinctId: string;
  event: AnalyticsEvent;
  // NEVER place email, name, or phone here — only non-identifying context.
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): Promise<void>;
}
