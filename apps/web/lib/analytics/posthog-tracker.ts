import { PostHog } from "posthog-node";
import type { Tracker, TrackedEvent } from "./types";

// The PostHog adapter behind the provider-agnostic contract, mirroring the
// Resend notification adapter. Nothing upstream of this file references
// `posthog-node` directly — vendors are swappable behind Tracker.

export interface PostHogConfig {
  token: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  // Per the offline PostHog Next.js docs: server-side functions are
  // short-lived (especially on Cloudflare Workers), so flush immediately —
  // flushAt: 1, flushInterval: 0 — and await client.shutdown() in capture() to
  // force the batched event out before the request context ends.
  const client = new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    name: "posthog",
    async capture(event: TrackedEvent) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      await client.shutdown();
    },
  };
}
