import { PostHog } from "posthog-node";
import type { ExperimentsClient } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly.

export interface PostHogConfig {
  projectToken: string;
  host?: string;
}

export function createPostHogExperimentsClient(config: PostHogConfig): ExperimentsClient {
  const client = new PostHog(config.projectToken, {
    host: config.host,
    // Server functions are short-lived, so flush every capture immediately
    // rather than batching.
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    name: "posthog",
    async getFlag(key, distinctId) {
      const flags = await client.evaluateFlags(distinctId, { flagKeys: [key] });
      return flags.getFlag(key);
    },
    // Per AGENTS.md's Cloudflare Workers rule, never fire-and-forget in a
    // request: captureImmediate awaits delivery before OpenNext can end the
    // request context.
    async capture(event) {
      await client.captureImmediate({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
  };
}
