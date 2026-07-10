import { PostHog } from "posthog-node";
import type { AnalyticsTracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind AnalyticsTracker.

export interface PostHogTrackerConfig {
  projectToken: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogTrackerConfig): AnalyticsTracker {
  const client = new PostHog(config.projectToken, {
    host: config.host,
    // Server functions are short-lived, so flush every capture immediately
    // rather than batching (see docs/vendor/posthog-nextjs.md).
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
