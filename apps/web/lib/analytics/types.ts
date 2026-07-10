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
  // Flushes and releases the underlying client. Call exactly once, after all
  // captures for this tracker's lifetime (e.g. once per request at the
  // composition root) — not per capture, since a single tracker instance is
  // commonly reused across multiple captures within one flow.
  close(): Promise<void>;
}
