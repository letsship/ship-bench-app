import { PostHog } from "posthog-node";
import type { AnalyticsTracker } from "./types";

export interface PostHogTrackerConfig {
  apiKey: string;
  host: string;
}

export function createPostHogTracker(config: PostHogTrackerConfig): AnalyticsTracker {
  const posthog = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    async capture({ distinctId, event, properties }) {
      posthog.capture({ distinctId, event, properties });
      await posthog.shutdown();
    },
  };
}
