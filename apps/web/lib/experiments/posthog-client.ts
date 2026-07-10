import { PostHog } from "posthog-node";
import type { ExperimentClient } from "./types";

const WAITLIST_EXPERIMENT_FLAG = "waitlist_experiment";

export interface PostHogConfig {
  apiKey: string;
  host: string;
}

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — experiments are swappable
// behind ExperimentClient. Builds a short-lived client per call and always
// awaits shutdown() before returning, per docs/vendor/posthog-nextjs.md's
// guidance for short-lived server functions (and this repo's Cloudflare
// Workers rule against un-awaited async work in a route handler).
export function createPostHogClient(config: PostHogConfig): ExperimentClient {
  return {
    async getWaitlistVariant(memberId) {
      const client = new PostHog(config.apiKey, {
        host: config.host,
        flushAt: 1,
        flushInterval: 0,
      });
      try {
        const flags = await client.evaluateFlags(memberId, {
          flagKeys: [WAITLIST_EXPERIMENT_FLAG],
        });
        const variant = flags.getFlag(WAITLIST_EXPERIMENT_FLAG);
        // An unset/non-string flag (e.g. PostHog unreachable) falls back to
        // today's behavior — waitlist as normal — never the new "control"
        // deny path, so an outage can't newly turn members away.
        return typeof variant === "string" ? variant : "unknown";
      } finally {
        await client.shutdown();
      }
    },
    async captureWaitlistJoined({ memberId, sessionId }) {
      const client = new PostHog(config.apiKey, {
        host: config.host,
        flushAt: 1,
        flushInterval: 0,
      });
      try {
        client.capture({
          distinctId: memberId,
          event: "waitlist_joined",
          properties: { sessionId },
        });
      } finally {
        await client.shutdown();
      }
    },
  };
}
