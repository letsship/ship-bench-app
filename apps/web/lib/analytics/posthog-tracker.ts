import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the vendor-agnostic contract. Nothing upstream of
// this file references posthog-node — trackers are swappable behind Tracker.

export interface PostHogConfig {
  token: string;
  // e.g. "https://us.i.posthog.com".
  host: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  // Per the PostHog Next.js guide: server-side functions are short-lived, so we
  // disable batching (flushAt 1 / flushInterval 0). On Cloudflare Workers the
  // request context ends with the response, so the flush is awaited — never
  // fire-and-forget.
  const client = new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    async capture({ event, distinctId, properties }) {
      client.capture({ event, distinctId, properties });
      await client.flush();
    },
  };
}
