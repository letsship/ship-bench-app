import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references PostHog directly — vendors are swappable behind
// Tracker.

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const client = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });

  return {
    capture(event) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
  };
}
