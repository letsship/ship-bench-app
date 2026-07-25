export interface CaptureEvent {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: CaptureEvent): Promise<void>;
}
