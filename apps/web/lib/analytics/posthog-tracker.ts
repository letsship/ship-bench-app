import { PostHog } from "posthog-node";
import type { AnalyticsTracker } from "./types";

// The PostHog adapter behind the vendor-agnostic contract. Nothing upstream of
// this file references posthog-node directly — vendors are swappable behind
// AnalyticsTracker.

export interface PostHogConfig {
  apiKey: string;
  // e.g. "https://us.i.posthog.com"; the client default is used when omitted.
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): AnalyticsTracker {
  // Route handlers are short-lived (and Workers drop un-awaited work), so
  // flush every capture immediately instead of batching — see
  // docs/vendor/posthog-nextjs.md.
  const client = new PostHog(config.apiKey, {
    host: config.host,
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
      await client.flush();
    },
  };
}
