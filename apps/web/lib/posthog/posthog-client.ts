import { PostHog } from "posthog-node";
import type { PostHogClient } from "./types";

// The posthog-node adapter behind the provider-agnostic contract. Nothing
// upstream of this file references posthog-node directly.

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

// Booking is on the hot path, so a slow/unreachable PostHog must never stall
// it — flag lookups are capped and fail open to `undefined` (treated as a
// non-control variant, see experiments.ts).
const FLAG_LOOKUP_TIMEOUT_MS = 2000;

export function createPostHogNodeClient(config: PostHogConfig): PostHogClient {
  const client = new PostHog(config.apiKey, { host: config.host });
  return {
    name: "posthog",
    async getFeatureFlag(flagKey, distinctId) {
      try {
        return await Promise.race([
          client.getFeatureFlag(flagKey, distinctId),
          new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), FLAG_LOOKUP_TIMEOUT_MS),
          ),
        ]);
      } catch {
        return undefined;
      }
    },
    async capture({ distinctId, event, properties }) {
      await client.captureImmediate({ distinctId, event, properties });
    },
  };
}
