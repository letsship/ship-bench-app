export type AnalyticsEventName =
  | "booking_created"
  | "waitlist_joined"
  | "booking_cancelled";

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  distinctId: string;
  properties: Record<string, unknown>;
}

export interface Tracker {
  capture(event: AnalyticsEvent): Promise<void>;
}
