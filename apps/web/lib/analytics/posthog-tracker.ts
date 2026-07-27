import { PostHog } from "posthog-node";
import type { CaptureEvent, Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable behind
// Tracker. This is the ONLY module that imports posthog-node.

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const posthog = new PostHog(config.apiKey, {
    host: config.host,
    flushInterval: 10000,
  });

  return {
    async capture(event: CaptureEvent) {
      try {
        posthog.capture({
          distinctId: event.distinctId,
          event: event.event,
          properties: event.properties,
        });
        // Await flush to ensure no async work is dropped on Cloudflare Workers.
        await posthog.flush();
      } catch (error) {
        // Analytics failures must never block the primary response.
        console.error("Analytics capture failed:", error);
      }
    },
  };
}
