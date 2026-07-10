import { createFakeProvider } from "./fake-provider";
import { createPostHogProvider } from "./posthog-provider";
import type { AnalyticsClient } from "./types";

// The app's analytics client. Unlike email, PostHog is optional — an
// experiment is not a delivery-critical dependency, so an unconfigured key
// falls back to the in-memory fake rather than throwing. The local
// fake-backends mode always uses the fake, same as notifications.
export function createAnalyticsClient(): AnalyticsClient {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeProvider();
  }
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return createFakeProvider();
  }
  return createPostHogProvider({
    apiKey,
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
}
