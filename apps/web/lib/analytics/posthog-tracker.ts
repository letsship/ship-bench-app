import { PostHog } from "posthog-node";
import type { CaptureEvent, Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind Tracker.

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  // Server-side functions can be short-lived, so flush immediately rather
  // than batching (per PostHog's Next.js guidance).
  const client = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    capture(event: CaptureEvent) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
    async shutdown() {
      await client.shutdown();
    },
  };
}
