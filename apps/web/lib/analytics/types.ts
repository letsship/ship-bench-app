// The provider-agnostic analytics contract. Services and domain code depend
// only on this interface; concrete vendors (today: PostHog) implement it.
// Events never carry personally-identifying data — the member's id is the
// distinct id and properties stay structural (e.g. session_id).

export interface CaptureEvent {
  // The analytics distinct id. We use the member's id — never an email or name.
  distinctId: string;
  // The event name, e.g. "booking_created" | "waitlist_joined" | "booking_cancelled".
  event: string;
  properties: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): Promise<void>;
}
