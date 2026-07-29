import { PostHog } from "posthog-node";
import type { Tracker } from "./types";

// The PostHog adapter behind the provider-agnostic Tracker contract. Nothing
// upstream of this file imports posthog-node — the vendor stays swappable
// behind Tracker, exactly like the Resend adapter behind NotificationProvider.

export interface PostHogConfig {
  projectToken: string;
  host?: string;
}

export function createPostHogTracker(config: PostHogConfig): Tracker {
  // Server-side functions are short-lived, so flush eagerly (per the PostHog
  // Next.js guide: flushAt 1, flushInterval 0) and AWAIT the flush — on
  // Cloudflare Workers the request context ends with the response and any
  // un-awaited send is silently dropped.
  const client = new PostHog(config.projectToken, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  });
  return {
    async capture(event) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      });
      await client.flush();
    },
  };
}
