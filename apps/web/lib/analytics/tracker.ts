import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

// The app's analytics tracker. Production uses PostHog (a real project token
// is required — a missing token is surfaced as an error, never silently
// degraded). The local fake-backends mode uses the in-memory recorder so the
// app runs with no vendor account.
export function createAnalyticsTracker(): AnalyticsTracker {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!projectToken) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Set it for real analytics capture, or run with USE_FAKE_BACKENDS=1.",
    );
  }
  return createPostHogTracker({
    projectToken,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
