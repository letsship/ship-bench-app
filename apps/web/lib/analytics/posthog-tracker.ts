import { PostHog } from "posthog-node";
import type { CaptureEvent, Tracker } from "./types";

// The PostHog adapter behind the tracker-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable behind
// Tracker.

export interface PostHogConfig {
  projectToken: string;
  host: string;
}

export function createPosthogTracker(config: PostHogConfig): Tracker {
  const posthog = new PostHog(config.projectToken, {
    host: config.host,
    // Server-side functions are short-lived (Next.js route handlers), so flush immediately
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
      // Flush and shutdown immediately because this is a short-lived handler
      await posthog.shutdown();
    },
  };
}
