import { PostHog } from "posthog-node";
import type { AnalyticsEvent, ExperimentClient } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references posthog-node directly — vendors are swappable
// behind ExperimentClient. Analytics must never block a booking: every SDK
// call is wrapped so a failure is logged and fails open instead of throwing.

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

export function createPostHogClient(config: PostHogConfig): ExperimentClient {
  const client = new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });

  return {
    async getExperimentVariant(distinctId, flagKey) {
      try {
        // Only evaluateFlags() + getFlag() record an exposure event — getAllFlags()
        // and payload-only accessors would silently exclude this member from the
        // experiment (see docs/vendor/posthog-experiments.md).
        const flags = await client.evaluateFlags(distinctId);
        const value = flags.getFlag(flagKey);
        return typeof value === "string" ? value : null;
      } catch (error) {
        console.error("PostHog getExperimentVariant failed", error);
        return null;
      } finally {
        // Per-request cleanup: flush (not shutdown, which is a once-before-exit
        // call) so the batched exposure event is sent before the Worker's
        // request context ends.
        await client.flush();
      }
    },
    async captureEvent(event: AnalyticsEvent) {
      try {
        client.capture({
          distinctId: event.distinctId,
          event: event.event,
          properties: event.properties,
        });
        await client.flush();
      } catch (error) {
        console.error("PostHog captureEvent failed", error);
      }
    },
  };
}
