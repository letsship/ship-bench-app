import type { CaptureEvent, Tracker } from "./types";

// Real PostHog adapter implementing Tracker by wrapping the posthog-node client.
// This is the ONLY module that imports posthog-node; it is constructed only at
// the composition root.
export function createPosthogTracker(apiKey: string, host?: string): Tracker {
  return {
    capture(event: CaptureEvent) {
      // Dynamic import so posthog-node is only loaded if the real tracker is used.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const posthog = require("posthog-node");
      const client = new posthog.PostHog(apiKey, { host });
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
    },
  };
}
