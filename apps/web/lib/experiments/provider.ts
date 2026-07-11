import { createFakeExperimentsClient } from "./fake-client";
import { createPostHogExperimentsClient } from "./posthog-client";
import type { ExperimentsClient } from "./types";

// The app's experiments client. Unlike the notification provider, this fails
// open to the fake/no-op client when PostHog isn't configured — a booking
// must never fail because analytics is unconfigured, and the fake client's
// unset flags resolve every member to the variant group (today's behavior).
export function createExperimentsClient(): ExperimentsClient {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakeExperimentsClient();
  }
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!projectToken) {
    return createFakeExperimentsClient();
  }
  return createPostHogExperimentsClient({
    projectToken,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
