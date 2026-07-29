import { PostHog } from "posthog-node";
import type { CaptureEvent, Tracker } from "./types";

// The sole module that imports the posthog-node package. Wraps a PostHog client
// and adapts its .capture() to the Tracker interface. Never imported by service
// or domain code — only by the composition root.

export interface PostHogTrackerOptions {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(options: PostHogTrackerOptions): Tracker {
  const client = new PostHog(options.apiKey, {
    host: options.host ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  return {
    name: "posthog",
    async capture(event: CaptureEvent): Promise<void> {
      try {
        client.capture({
          distinctId: event.distinctId,
          event: event.event,
          properties: event.properties,
        });
        await client.flush();
      } catch (error) {
        console.error("PostHog capture failed", error);
      } finally {
        await client.shutdown();
      }
    },
  };
}