import { serverEnv } from "@/lib/env";
import { createFakePostHogClient } from "./fake-client";
import { createRealPostHogClient } from "./posthog-client";
import type { PostHogClient } from "./types";

// The app's PostHog client. Production talks to the real PostHog project when
// configured. Unlike the email provider, a missing API key must NOT break
// booking — the experiment helper already treats an unresolvable flag as
// "variant" (today's behavior), so an unconfigured or unreachable PostHog
// project should degrade the same way rather than take booking down for
// everyone. The local fake-backends mode uses the same in-memory recorder.
export function createPostHogClient(): PostHogClient {
  if (process.env.USE_FAKE_BACKENDS === "1") {
    return createFakePostHogClient();
  }
  const { POSTHOG_API_KEY, POSTHOG_HOST } = serverEnv();
  if (!POSTHOG_API_KEY) {
    console.warn(
      "POSTHOG_API_KEY is not set; the waitlist experiment defaults every member to the variant group and drops captured events.",
    );
    return createFakePostHogClient();
  }
  return createRealPostHogClient({ apiKey: POSTHOG_API_KEY, host: POSTHOG_HOST });
}
