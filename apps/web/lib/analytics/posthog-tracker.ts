import { PostHog } from "posthog-node";
import type { AnalyticsEvent, AnalyticsTracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable behind
// AnalyticsTracker.

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
    capture(event: AnalyticsEvent): void {
      posthog.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
  };
}
