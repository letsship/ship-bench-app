import { serverEnv } from "@/lib/env";
import { createFakeExperimentClient } from "./fake-client";
import { createPostHogClient } from "./posthog-client";
import type { ExperimentClient } from "./types";

// The app's experiment client. Production uses PostHog (a real project API
// key is required — a missing key is surfaced as an error, never silently
// degraded). The local fake-backends mode uses the in-memory recorder so the
// app runs with no vendor account. Mirrors
// lib/notifications/provider.ts::createNotificationProvider.
export function createExperimentClient(): ExperimentClient {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeExperimentClient();
  }
  const { POSTHOG_PROJECT_API_KEY, POSTHOG_HOST } = serverEnv();
  if (!POSTHOG_PROJECT_API_KEY) {
    throw new Error(
      "POSTHOG_PROJECT_API_KEY is not set. Set it for real experiment evaluation, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogClient({ apiKey: POSTHOG_PROJECT_API_KEY, host: POSTHOG_HOST });
}
