import { PostHog } from "posthog-node";
import type { CaptureEvent, Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic contract. Nothing upstream
// of this file references `posthog-node` directly — vendors are swappable
// behind `Tracker`, the analytics mirror of `lib/notifications/resend-provider.ts`.
//
// Server functions in this app are short-lived (Next route handlers on
// Cloudflare Workers end the request context once the response is sent), so we
// configure the client to flush eagerly and call `flush()` on every capture so
// no event is silently dropped — per docs/vendor/posthog-nextjs.md.

export interface PostHogConfig {
  token: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  const client = new PostHog(config.token, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    name: "posthog",
    async capture(event: CaptureEvent) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties ?? {},
      });
      await client.flush();
    },
  };
}
