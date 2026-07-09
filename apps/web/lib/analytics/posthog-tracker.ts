import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind Tracker.

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const client = new PostHog(config.apiKey, { host: config.host });
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
