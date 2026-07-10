import type { AnalyticsEvent } from "./types";

// Pure builders for the funnel events. Each takes only a member id and a
// class session id, so no PII (email/name/phone) can ever flow through this
// layer into a captured event.

export function bookingCreatedEvent(memberId: string, sessionId: string): AnalyticsEvent {
  return { distinctId: memberId, event: "booking_created", properties: { session_id: sessionId } };
}

export function waitlistJoinedEvent(memberId: string, sessionId: string): AnalyticsEvent {
  return { distinctId: memberId, event: "waitlist_joined", properties: { session_id: sessionId } };
}

export function bookingCancelledEvent(memberId: string, sessionId: string): AnalyticsEvent {
  return {
    distinctId: memberId,
    event: "booking_cancelled",
    properties: { session_id: sessionId },
  };
}
