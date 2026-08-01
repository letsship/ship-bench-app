import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

export interface PostHogTrackerConfig {
  token: string;
  host: string;
}

export function createPostHogTracker(config: PostHogTrackerConfig): Tracker {
  const client = new PostHog(config.token, {
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
      await client.flush();
    },
  };
}
