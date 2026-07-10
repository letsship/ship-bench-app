import { serverEnv } from "@/lib/env";
import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

// The app's analytics tracker. Production uses PostHog when configured. Unlike
// the notification provider, a missing/broken PostHog config degrades to a
// no-op tracker (logged, not thrown): losing product-analytics visibility must
// never take down booking/cancellation for a member. The local fake-backends
// mode always uses the in-memory recorder so the app runs with no vendor
// account.
export function createAnalyticsTracker(): AnalyticsTracker {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const { POSTHOG_PROJECT_API_KEY: apiKey, POSTHOG_HOST: host } = serverEnv();
  if (!apiKey || !host) {
    console.error(
      "POSTHOG_PROJECT_API_KEY / POSTHOG_HOST are not set. Analytics capture is disabled for this request.",
    );
    return createFakeTracker();
  }
  try {
    return createPostHogTracker({ apiKey, host });
  } catch (err) {
    console.error(
      "Failed to construct the PostHog client. Analytics capture is disabled for this request.",
      err,
    );
    return createFakeTracker();
  }
}
