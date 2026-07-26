import type { CaptureEvent } from "./types";

// Pure builders for each analytics event. This is the single choke point that
// assembles event properties, so no caller can accidentally leak email, name,
// or phone into a captured event.

export function bookingCreated(memberId: string, sessionId: string): CaptureEvent {
  return {
    event: "booking_created",
    distinctId: memberId,
    properties: { session_id: sessionId },
  };
}

export function waitlistJoined(memberId: string, sessionId: string): CaptureEvent {
  return {
    event: "waitlist_joined",
    distinctId: memberId,
    properties: { session_id: sessionId },
  };
}

export function bookingCancelled(memberId: string, sessionId: string): CaptureEvent {
  return {
    event: "booking_cancelled",
    distinctId: memberId,
    properties: { session_id: sessionId },
  };
}
