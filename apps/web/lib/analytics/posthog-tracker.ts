import { PostHog } from "posthog-node";
import type { AnalyticsTracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind AnalyticsTracker.

export interface PostHogConfig {
  projectToken: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): AnalyticsTracker {
  // Server-side functions can be short-lived, so flush immediately instead of
  // batching (per docs/vendor/posthog-nextjs.md).
  const client = new PostHog(config.projectToken, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    capture({ event, distinctId, properties }) {
      client.capture({ distinctId, event, properties });
    },
  };
}
