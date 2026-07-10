import { PostHog } from "posthog-node";
import type { AnalyticsTracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind AnalyticsTracker.

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

export function createPostHogTracker(config: PostHogConfig): AnalyticsTracker {
  const client = new PostHog(config.apiKey, {
    host: config.host,
    // Server-side functions here can be short-lived (Cloudflare Workers ends
    // the request context once the response is sent), so flush every capture
    // immediately rather than batching.
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    name: "posthog",
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
