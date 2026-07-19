import { PostHog } from "posthog-node";
import type { AnalyticsTracker, CaptureEvent } from "./types";

export interface PostHogConfig {
  token: string;
  host: string;
}

export function createPostHogTracker(config: PostHogConfig): AnalyticsTracker {
  const posthog = new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });

  return {
    async capture(event: CaptureEvent) {
      posthog.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      await posthog.shutdown();
    },
  };
}
