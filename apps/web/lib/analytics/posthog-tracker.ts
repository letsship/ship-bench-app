import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic `Tracker` contract. Nothing
// upstream of this file references `posthog-node` directly — vendors are
// swappable behind `Tracker`, exactly as `resend-provider.ts` hides Resend.
//
// `flushAt: 1` and `flushInterval: 0` make captures flush immediately, and we
// `await posthog.flush()` after each one. This is mandatory under Cloudflare
// Workers / OpenNext: the request context ends as soon as the response is sent,
// dropping any un-awaited async work. We never fire-and-forget a capture.

export interface PostHogConfig {
  token: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const posthog = new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    async capture(event) {
      posthog.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      await posthog.flush();
    },
  };
}
