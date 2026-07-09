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
    async capture(event) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      // A fresh client is constructed per request (see provider.ts) and is
      // never reused, so the internal batch queue must be flushed before the
      // handler returns — otherwise short-lived serverless invocations can be
      // torn down before the batched event is ever sent.
      await client.flush();
    },
  };
}
