// The provider-agnostic experiment/analytics contract. Services depend only on
// this interface; the concrete vendor (today: PostHog) implements it. Mirrors
// the shape of lib/notifications/types.ts.

export interface AnalyticsEvent {
  distinctId: string;
  event: string;
  // No personally-identifying data (email, name) belongs here.
  properties?: Record<string, unknown>;
}

export interface ExperimentClient {
  // Resolves the flag/experiment variant for a distinct id (e.g. a member id).
  // Returns null when the flag is unset, unresolvable, or the SDK call fails —
  // callers must treat null as "no decision" and fail open.
  getExperimentVariant(distinctId: string, flagKey: string): Promise<string | null>;
  captureEvent(event: AnalyticsEvent): Promise<void>;
}
