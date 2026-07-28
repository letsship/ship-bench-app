import { PostHog } from "posthog-node";
import type { AnalyticsEvent, Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references PostHog directly — vendors are swappable behind
// Tracker.

export interface PosthogTrackerConfig {
  apiKey: string;
  host?: string;
}

export function createPosthogTracker(config: PosthogTrackerConfig): Tracker {
  const client = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    name: "posthog",
    capture(event: AnalyticsEvent): Promise<void> {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      return client.shutdown();
    },
  };
}