import { PostHog } from "posthog-node";
import type { AnalyticsEvent, Tracker } from "./types";

// The PostHog adapter behind the Tracker interface. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind Tracker.

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const posthog = new PostHog(config.apiKey, {
    host: config.host,
    // For Next.js server-side functions (short-lived), flush immediately
    // when a single event is captured, and don't wait. This ensures events
    // are sent before the function exits without blocking request latency.
    flushAt: 1,
    flushInterval: 0,
  });

  return {
    async capture(event: AnalyticsEvent) {
      posthog.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
  };
}
