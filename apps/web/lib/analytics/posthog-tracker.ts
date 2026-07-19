import { PostHog } from "posthog-node";
import type { AnalyticsEvent, Tracker } from "./types";

export interface PostHogTracker extends Tracker {
  readonly client: PostHog;
}

export function createPostHogTracker(options: { apiKey: string; host: string }): PostHogTracker {
  const client = new PostHog(options.apiKey, { host: options.host });
  return {
    client,
    capture(event: AnalyticsEvent): void {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
  };
}
