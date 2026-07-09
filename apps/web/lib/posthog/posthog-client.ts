import { PostHog } from "posthog-node";
import type { PostHogClient } from "./types";

// The posthog-node adapter behind the provider-agnostic contract. Nothing
// upstream of this file references posthog-node directly.

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

export function createRealPostHogClient(config: PostHogConfig): PostHogClient {
  const client = new PostHog(config.apiKey, {
    host: config.host,
    // Requests on this app's serverless runtime complete right after the
    // handler returns, so the SDK's default event batching risks dropping a
    // capture before it's flushed — send every event immediately instead.
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    async getFeatureFlag(key, distinctId) {
      return client.getFeatureFlag(key, distinctId);
    },
    async capture(event) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
  };
}
