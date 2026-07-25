import type { CaptureEvent } from "./types";

export interface EventInput {
  memberId: string;
  sessionId: string;
}

export function bookingCreated(input: EventInput): CaptureEvent {
  return {
    event: "booking_created",
    distinctId: input.memberId,
    properties: {
      session_id: input.sessionId,
    },
  };
}

export function waitlistJoined(input: EventInput): CaptureEvent {
  return {
    event: "waitlist_joined",
    distinctId: input.memberId,
    properties: {
      session_id: input.sessionId,
    },
  };
}

export function bookingCancelled(input: EventInput): CaptureEvent {
  return {
    event: "booking_cancelled",
    distinctId: input.memberId,
    properties: {
      session_id: input.sessionId,
    },
  };
}
