// The provider-agnostic analytics contract. The booking, waitlist, and
// cancellation services depend only on this interface; the concrete vendor
// (today: PostHog) is constructed only at the composition root, mirroring the
// notification adapter (`lib/notifications/types.ts`). Domain and service code
// never imports a `posthog` package directly.

export type AnalyticsEventName =
  | "booking_created"
  | "waitlist_joined"
  | "booking_cancelled";

export interface CaptureInput {
  event: string;
  // The member's id, used as PostHog's distinct id so every funnel event is
  // attributed to the right member.
  distinctId: string;
  // Event properties. Must NOT carry personally-identifying data (no email,
  // name, or phone) — only opaque ids such as the booked class session id.
  properties?: Record<string, unknown>;
}

export interface Tracker {
  readonly name: string;
  capture(input: CaptureInput): void;
}
