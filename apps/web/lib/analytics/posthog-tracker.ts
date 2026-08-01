import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references PostHog directly — vendors are swappable behind
// Tracker.

export interface PostHogConfig {
  apiKey: string;
  // The PostHog instance to send to, e.g. "https://eu.i.posthog.com".
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  // Server route handlers are short-lived (and Cloudflare Workers drop
  // un-awaited work once the response is sent), so flush every capture
  // immediately instead of batching — see docs/vendor/posthog-nextjs.md.
  const posthog = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    name: "posthog",
    async capture(event) {
      posthog.capture({
        distinctId: event.distinctId,
        event: event.name,
        properties: event.properties,
      });
      await posthog.flush();
    },
  };
}
