import type { ClassSession, Member } from "@/lib/db/types";
import type { CaptureEvent } from "./types";

function bookingEvent(
  event: CaptureEvent["event"],
  member: Member,
  session: ClassSession,
): CaptureEvent {
  return {
    distinctId: member.id,
    event,
    properties: { session_id: session.id },
  };
}

export function bookingCreated(member: Member, session: ClassSession): CaptureEvent {
  return bookingEvent("booking_created", member, session);
}

export function waitlistJoined(member: Member, session: ClassSession): CaptureEvent {
  return bookingEvent("waitlist_joined", member, session);
}

export function bookingCancelled(member: Member, session: ClassSession): CaptureEvent {
  return bookingEvent("booking_cancelled", member, session);
}
