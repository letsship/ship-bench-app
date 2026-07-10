// The provider-agnostic experiment contract. Services depend only on this
// interface; the concrete vendor (PostHog) implements it. Mirrors the
// notification provider seam in lib/notifications/types.ts.

export interface ExperimentClient {
  // The raw PostHog flag value for `waitlist_experiment`, evaluated for this
  // member (e.g. "control", "test"). Uses an API that records an exposure
  // event, per docs/vendor/posthog-experiments.md.
  getWaitlistVariant(memberId: string): Promise<string>;
  // Records the waitlist_joined goal event. No personally-identifying data —
  // only the member id (as the distinct id) and the session id.
  captureWaitlistJoined(params: { memberId: string; sessionId: string }): Promise<void>;
}
