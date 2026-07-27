import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind Tracker.

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const client = new PostHog(config.apiKey, { host: config.host });
  return {
    // captureImmediate sends synchronously rather than queuing — required on
    // Cloudflare Workers, which ends the request context once the response is
    // sent, silently dropping any queued (un-awaited) work.
    async capture({ event, distinctId, properties }) {
      await client.captureImmediate({ event, distinctId, properties });
    },
  };
}
