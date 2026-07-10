import { PostHog } from "posthog-node";
import type { AnalyticsEvent, AnalyticsTracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind AnalyticsTracker.

export interface PosthogConfig {
  apiKey: string;
  host: string;
}

export function createPosthogTracker(config: PosthogConfig): AnalyticsTracker {
  // Requests are short-lived, so flush every capture immediately rather than
  // batching, per PostHog's Next.js server-side guidance.
  const client = new PostHog(config.apiKey, { host: config.host, flushAt: 1, flushInterval: 0 });
  return {
    async capture(event: AnalyticsEvent) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      await client.shutdown();
    },
  };
}
