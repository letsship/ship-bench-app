// The provider-agnostic analytics contract. Service and domain code depend
// only on this interface; concrete vendors (today: PostHog) implement it.

export interface AnalyticsEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export interface Tracker {
  capture(event: AnalyticsEvent): void | Promise<void>;
}
