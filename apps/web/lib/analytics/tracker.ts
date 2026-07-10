import { createFakeTracker } from "./fake-tracker";
import { createPostHogTracker } from "./posthog-tracker";
import type { AnalyticsTracker } from "./types";

// A tracker that captures nothing. Analytics is best-effort observability, not
// a booking dependency — a missing or broken PostHog credential must never
// take down the flow it's trying to observe, so misconfiguration degrades to
// this instead of throwing.
const noopTracker: AnalyticsTracker = {
  async capture() {},
};

// The app's analytics tracker. Production uses PostHog when a project token is
// configured; a missing token or a failed client construction is logged and
// falls back to the no-op tracker rather than throwing. The local
// fake-backends mode uses the in-memory recorder so the app runs with no
// vendor account.
export function createAnalyticsTracker(): AnalyticsTracker {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeTracker();
  }
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!projectToken) {
    console.error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set; analytics capture is disabled for this request.",
    );
    return noopTracker;
  }
  try {
    return createPostHogTracker({
      projectToken,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    });
  } catch (error) {
    console.error("Failed to construct the PostHog tracker; analytics capture is disabled.", error);
    return noopTracker;
  }
}
