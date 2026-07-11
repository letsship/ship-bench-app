import type { ExperimentEvent, ExperimentsClient, FlagValue } from "./types";

// An in-memory experiments client for tests and the local fake-backends mode.
// Tests preset a flag's value per (key, distinctId) via `setFlag()`, and every
// captured event is recorded so tests can assert on it. Also reused as the
// fail-open fallback when PostHog isn't configured (see provider.ts).
export interface FakeExperimentsClient extends ExperimentsClient {
  readonly captured: ExperimentEvent[];
  setFlag(key: string, distinctId: string, value: FlagValue): void;
}

export function createFakeExperimentsClient(): FakeExperimentsClient {
  const flags = new Map<string, FlagValue>();
  const captured: ExperimentEvent[] = [];
  return {
    name: "fake",
    captured,
    setFlag(key, distinctId, value) {
      flags.set(`${key}:${distinctId}`, value);
    },
    async getFlag(key, distinctId) {
      return flags.get(`${key}:${distinctId}`);
    },
    async capture(event) {
      captured.push(event);
    },
  };
}
