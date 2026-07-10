import type { AnalyticsClient, AnalyticsEvent } from "./types";

// An in-memory analytics provider for tests and the local fake-backends mode.
// It lets a test preset a flag's value per distinct id and records every
// captured event so tests can assert on exposure/goal tracking without a
// vendor account or network.
export interface FakeProvider extends AnalyticsClient {
  readonly captured: AnalyticsEvent[];
  setFlag(distinctId: string, flagKey: string, value: string | boolean): void;
}

export function createFakeProvider(): FakeProvider {
  const flags = new Map<string, string | boolean>();
  const captured: AnalyticsEvent[] = [];
  const flagKeyOf = (distinctId: string, flagKey: string) => `${distinctId}::${flagKey}`;

  return {
    captured,
    setFlag(distinctId, flagKey, value) {
      flags.set(flagKeyOf(distinctId, flagKey), value);
    },
    async getFlag(distinctId, flagKey) {
      return flags.get(flagKeyOf(distinctId, flagKey));
    },
    async capture(event) {
      captured.push(event);
    },
  };
}
