export type CaptureEventType = "booking_created" | "waitlist_joined" | "booking_cancelled";

export interface CaptureEvent {
  distinctId: string;
  event: CaptureEventType;
  properties: Record<string, unknown>;
}

export interface AnalyticsTracker {
  capture(event: CaptureEvent): Promise<void>;
}
