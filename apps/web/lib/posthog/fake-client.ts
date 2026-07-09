import type { CaptureEvent, FeatureFlagValue, PostHogClient } from "./types";

// An in-memory PostHog client for tests and the local fake-backends mode.
// Flag values are presettable per key; any flag that hasn't been preset
// defaults to `true` (a non-"control" value) so the pre-experiment behavior
// (always waitlist) is preserved unless a test opts into the control group.
export interface FakeClient extends PostHogClient {
  readonly captured: CaptureEvent[];
  setFlag(flagKey: string, value: FeatureFlagValue): void;
}

export function createFakeClient(): FakeClient {
  const flags = new Map<string, FeatureFlagValue>();
  const captured: CaptureEvent[] = [];
  return {
    name: "fake",
    captured,
    setFlag(flagKey, value) {
      flags.set(flagKey, value);
    },
    async getFeatureFlag(flagKey) {
      return flags.has(flagKey) ? flags.get(flagKey) : true;
    },
    async capture(event) {
      captured.push(event);
    },
  };
}
