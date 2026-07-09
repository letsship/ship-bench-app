import { createFakeClient } from "./fake-client";
import { createPostHogNodeClient } from "./posthog-client";
import type { PostHogClient } from "./types";

const DEFAULT_HOST = "https://us.i.posthog.com";

// The app's PostHog client. Unlike email, a missing/misconfigured PostHog key
// must never break booking — analytics/experiments are a side effect, not a
// hard dependency — so this always falls back to the in-memory fake instead
// of throwing.
export function createPostHogClient(): PostHogClient {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeClient();
  }
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return createFakeClient();
  }
  return createPostHogNodeClient({ apiKey, host: process.env.POSTHOG_HOST ?? DEFAULT_HOST });
}
