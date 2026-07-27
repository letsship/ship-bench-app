import { PostHog } from "posthog-node";
import type { AnalyticsTracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable behind
// AnalyticsTracker.

export interface PostHogConfig {
  token: string;
  host: string;
}

export function createPostHogTracker(config: PostHogConfig): AnalyticsTracker {
  const client = new PostHog(config.token, {
    host: config.host,
    // For short-lived workers/serverless: flush immediately on capture, never batch.
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
      // Flush immediately so events are sent before the request context ends
      // (critical for short-lived Workers/serverless).
      await client.flush();
    },
    async shutdown() {
      await client.shutdown();
    },
  };
}
