import { serverEnv } from "@/lib/env";
import { createFakePostHogClient } from "./fake-client";
import { createRealPostHogClient } from "./posthog-client";
import type { PostHogClient } from "./types";

// The app's PostHog client. Production talks to the real PostHog project (a
// real API key is required — a missing key is surfaced as an error, never
// silently degraded). The local fake-backends mode uses the in-memory
// recorder so the app runs with no vendor account.
export function createPostHogClient(): PostHogClient {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakePostHogClient();
  }
  const { POSTHOG_API_KEY, POSTHOG_HOST } = serverEnv();
  if (!POSTHOG_API_KEY) {
    throw new Error(
      "POSTHOG_API_KEY is not set. Set it to run the waitlist experiment, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createRealPostHogClient({ apiKey: POSTHOG_API_KEY, host: POSTHOG_HOST });
}
