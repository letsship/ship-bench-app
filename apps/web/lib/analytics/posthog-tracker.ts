import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references the `posthog` package directly — vendors are
// swappable behind `Tracker`, exactly as `resend-provider.ts` sits behind
// `NotificationProvider`. Follows the server-side Node SDK guidance in
// `docs/vendor/posthog-nextjs.md`: a short-lived client with `flushAt: 1` and
// `flushInterval: 0` so events are sent immediately and not batched on a
// serverless worker that may be torn down once the response is sent.

export interface PostHogTrackerConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogTrackerConfig): Tracker {
  const client = new PostHog(config.apiKey, {
    host: config.host,
    // Flush immediately — serverless workers (Cloudflare via OpenNext) end the
    // request context once the response is sent, so we never want events held
    // in an in-memory batch queue.
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    name: "posthog",
    capture({ event, distinctId, properties }) {
      client.capture({ event, distinctId, properties });
    },
  };
}
