import { PostHog } from "posthog-node";
import type { AnalyticsTracker } from "./types";

export interface PostHogTrackerConfig {
  apiKey: string;
  host: string;
}

export function createPostHogTracker(config: PostHogTrackerConfig): AnalyticsTracker {
  const posthog = new PostHog(config.apiKey, { host: config.host });
  return {
    capture({ distinctId, event, properties }) {
      posthog.capture({ distinctId, event, properties });
    },
  };
}
