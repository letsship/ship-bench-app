import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const posthog = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    async capture(event) {
      posthog.capture(event);
      await posthog.shutdown();
    },
  };
}
