export type AnalyticsEventName =
  | "booking_created"
  | "waitlist_joined"
  | "booking_cancelled";

export interface CaptureEvent {
  distinctId: string;
  event: AnalyticsEventName;
  properties: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): void | Promise<void>;
}
