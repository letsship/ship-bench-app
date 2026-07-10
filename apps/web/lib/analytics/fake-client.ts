import type { AnalyticsEvent, ExperimentClient } from "./types";

// An in-memory ExperimentClient for tests and the local fake-backends mode.
// Variants default to "test" (a non-control variant) when unconfigured, so
// today's always-waitlisted behavior is what you get unless a test opts a
// specific member into "control".
export interface FakeExperimentClient extends ExperimentClient {
  readonly captured: AnalyticsEvent[];
  setVariant(distinctId: string, variant: string): void;
}

export function createFakeExperimentClient(
  variants: Record<string, string> = {},
): FakeExperimentClient {
  const variantByDistinctId = new Map<string, string>(Object.entries(variants));
  const captured: AnalyticsEvent[] = [];

  return {
    captured,
    setVariant(distinctId, variant) {
      variantByDistinctId.set(distinctId, variant);
    },
    async getExperimentVariant(distinctId) {
      return variantByDistinctId.get(distinctId) ?? "test";
    },
    async captureEvent(event) {
      captured.push(event);
    },
  };
}
