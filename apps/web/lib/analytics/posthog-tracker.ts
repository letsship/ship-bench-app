import { PostHog } from "posthog-node";
import type { AnalyticsTracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references PostHog directly — vendors are swappable behind
// AnalyticsTracker.

export interface PosthogConfig {
  apiKey: string;
  // PostHog's ingestion host; defaults to their US cloud host.
  host?: string;
}

export function createPosthogTracker(config: PosthogConfig): AnalyticsTracker {
  const client = new PostHog(config.apiKey, { host: config.host });
  return {
    name: "posthog",
    async capture(event) {
      // captureImmediate sends the event straight away instead of queuing it
      // for a background flush — the app runs on a serverless/Workers
      // runtime where the process can be torn down right after the response
      // is sent, so a deferred flush could be lost.
      await client.captureImmediate({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
  };
}
