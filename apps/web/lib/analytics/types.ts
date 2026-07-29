// The provider-agnostic analytics contract. Services depend only on this
// interface; concrete vendors (today: PostHog) implement it — the same seam
// shape as lib/notifications. Events carry ids only, never
// personally-identifying data (no email, name, or phone).

export type AnalyticsEventName = "booking_created" | "waitlist_joined" | "booking_cancelled";

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  "booking_created",
  "waitlist_joined",
  "booking_cancelled",
];

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  // The member's id — never an email or name.
  distinctId: string;
  // Funnel attribution: the class session's id. Ids only, no PII.
  properties: { session_id: string };
}

export interface Tracker {
  capture(event: AnalyticsEvent): Promise<void>;
}
