// The provider-agnostic PostHog contract. The experiment helper and the
// booking service depend only on this interface; the concrete vendor
// (posthog-node) is wrapped behind it, matching lib/notifications/types.ts.

export type FeatureFlagValue = string | boolean | undefined;

export interface CaptureEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export interface PostHogClient {
  getFeatureFlag(key: string, distinctId: string): Promise<FeatureFlagValue>;
  capture(event: CaptureEvent): Promise<void>;
}
