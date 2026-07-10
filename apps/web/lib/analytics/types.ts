// The provider-agnostic analytics contract. Booking services depend only on
// this interface; concrete vendors (today: PostHog) implement it.

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  // The member's id — analytics is attributed to the member, never to email,
  // name, or phone.
  distinctId: string;
  properties: {
    session_id: string;
  };
}

export interface AnalyticsTracker {
  readonly name: string;
  capture(event: AnalyticsEvent): Promise<void>;
}
