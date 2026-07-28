import { PostHog } from "posthog-node";
import type { CaptureEvent, Tracker } from "./types";

// The real PostHog adapter behind the Tracker interface. This is the ONLY
// module that imports posthog-node; services depend on the Tracker interface,
// never on the vendor client. PostHog batches events, but a Next.js request
// (especially on Cloudflare Workers) ends once the response is sent, so we
// flush eagerly per capture to avoid losing funnel events.
export interface PostHogTrackerConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogTrackerConfig): Tracker {
  const client = new PostHog(config.apiKey, {
    host: config.host ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    async capture(event: CaptureEvent) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      await client.flush();
    },
  };
}
