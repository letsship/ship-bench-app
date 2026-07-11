// The provider-agnostic experiments contract. Feature-flag/event-capture
// callers depend only on this interface; concrete vendors (today: PostHog)
// implement it.

export type FlagValue = string | boolean | undefined;

export interface ExperimentEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

export interface ExperimentsClient {
  readonly name: string;
  getFlag(key: string, distinctId: string): Promise<FlagValue>;
  capture(event: ExperimentEvent): Promise<void>;
}
