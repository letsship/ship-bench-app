import { serverEnv } from "@/lib/env";
import { createFakeExperimentClient } from "./fake-client";
import { createPostHogClient } from "./posthog-client";
import type { ExperimentClient } from "./types";

// The app's analytics/experiment client. Unlike the Resend notification
// provider, a missing POSTHOG_API_KEY in real mode does NOT throw — analytics
// must never block a booking, so it degrades to a no-op client instead.
const noopClient: ExperimentClient = {
  async getExperimentVariant() {
    return null;
  },
  async captureEvent() {},
};

export function createAnalyticsClient(): ExperimentClient {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeExperimentClient();
  }
  const { POSTHOG_API_KEY, POSTHOG_HOST } = serverEnv();
  if (!POSTHOG_API_KEY) {
    return noopClient;
  }
  return createPostHogClient({ apiKey: POSTHOG_API_KEY, host: POSTHOG_HOST });
}
