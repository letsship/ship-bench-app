import PostHog from "posthog-node";
import type { CaptureEvent, Tracker } from "./types";

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const posthog = new PostHog(config.apiKey, {
    host: config.host || "https://us.posthog.com",
  });

  return {
    async capture(event: CaptureEvent) {
      posthog.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties ?? {},
      });
    },
  };
}
