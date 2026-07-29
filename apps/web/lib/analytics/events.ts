import type { AnalyticsEvent, CaptureEvent } from "./types";

// Pure builders for each analytics event kind. They own the event-name and
// property construction so the service code stays free of analytics detail.
// NO personally-identifying data (email, name, phone) ever enters properties.

export function bookingCreated(memberId: string, sessionId: string): CaptureEvent {
  return {
    event: "booking_created" as AnalyticsEvent,
    distinctId: memberId,
    properties: { session_id: sessionId },
  };
}

export function waitlistJoined(memberId: string, sessionId: string): CaptureEvent {
  return {
    event: "waitlist_joined" as AnalyticsEvent,
    distinctId: memberId,
    properties: { session_id: sessionId },
  };
}

export function bookingCancelled(memberId: string, sessionId: string): CaptureEvent {
  return {
    event: "booking_cancelled" as AnalyticsEvent,
    distinctId: memberId,
    properties: { session_id: sessionId },
  };
}