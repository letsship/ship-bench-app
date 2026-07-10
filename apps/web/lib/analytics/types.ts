// The provider-agnostic analytics contract. Feature-specific helpers (e.g.
// waitlist-experiment.ts) depend only on this interface; the concrete vendor
// (today: PostHog) is swapped in behind it via provider.ts.

export interface AnalyticsEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsClient {
  // Evaluates a feature flag / experiment for a distinct id. Implementations
  // must use an exposure-counting evaluation method (PostHog's
  // evaluateFlags/getFlag), not a payload-only or bulk accessor.
  getFlag(distinctId: string, flagKey: string): Promise<string | boolean | undefined>;
  capture(event: AnalyticsEvent): Promise<void>;
}
