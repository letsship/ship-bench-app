import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the analytics provider-agnostic contract. Nothing
// upstream of this file references PostHog directly — vendors are swappable
// behind Tracker.

export interface PostHogConfig {
  projectToken: string;
  host: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const client = new PostHog(config.projectToken, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });

  return {
    async capture(event) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      await client.shutdown();
    },
  };
}
