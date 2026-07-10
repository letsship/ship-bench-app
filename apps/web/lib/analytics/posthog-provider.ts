import { PostHog } from "posthog-node";
import type { AnalyticsClient, AnalyticsEvent } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind AnalyticsClient.

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

function newClient(config: PostHogConfig): PostHog {
  // Server-side functions here are short-lived (Cloudflare Workers ends the
  // request context once the response is sent), so we flush every call
  // immediately and shut the client down per invocation rather than batching.
  return new PostHog(config.apiKey, { host: config.host, flushAt: 1, flushInterval: 0 });
}

export function createPostHogProvider(config: PostHogConfig): AnalyticsClient {
  return {
    async getFlag(distinctId, flagKey) {
      const client = newClient(config);
      try {
        const flags = await client.evaluateFlags(distinctId);
        return flags.getFlag(flagKey);
      } finally {
        await client.shutdown();
      }
    },
    async capture(event: AnalyticsEvent) {
      const client = newClient(config);
      try {
        client.capture({
          distinctId: event.distinctId,
          event: event.event,
          properties: event.properties,
        });
      } finally {
        await client.shutdown();
      }
    },
  };
}
