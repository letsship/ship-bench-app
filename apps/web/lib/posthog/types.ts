// The provider-agnostic PostHog contract. Domain/service code depends only on
// this interface; the concrete vendor (posthog-node) implements it.

export type FeatureFlagValue = string | boolean;

export interface CaptureEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export interface PostHogClient {
  readonly name: string;
  getFeatureFlag(flagKey: string, distinctId: string): Promise<FeatureFlagValue | undefined>;
  capture(event: CaptureEvent): Promise<void>;
}
