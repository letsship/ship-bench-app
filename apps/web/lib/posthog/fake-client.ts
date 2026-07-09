import type { CaptureEvent, FeatureFlagValue, PostHogClient } from "./types";

// An in-memory PostHog client for tests and the local fake-backends mode. It
// records every captured event and lets callers pre-configure flag values
// without a vendor account or network.
export interface FakePostHogClient extends PostHogClient {
  readonly captured: CaptureEvent[];
  setFeatureFlag(key: string, distinctId: string, value: FeatureFlagValue): void;
}

export function createFakePostHogClient(): FakePostHogClient {
  const captured: CaptureEvent[] = [];
  const flags = new Map<string, FeatureFlagValue>();
  return {
    captured,
    setFeatureFlag(key, distinctId, value) {
      flags.set(`${key}:${distinctId}`, value);
    },
    async getFeatureFlag(key, distinctId) {
      return flags.get(`${key}:${distinctId}`);
    },
    async capture(event) {
      captured.push(event);
    },
  };
}
