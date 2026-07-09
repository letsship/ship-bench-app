import type { PostHogClient } from "./types";

// The one module allowed to know about PostHog experiment/event concepts.
// The booking service calls these two functions and never touches
// PostHogClient's flag/capture primitives directly.

const WAITLIST_EXPERIMENT_FLAG = "waitlist_experiment";
const WAITLIST_JOINED_EVENT = "waitlist_joined";

export type WaitlistExperimentVariant = "control" | "variant";

// Evaluates the `waitlist_experiment` flag for the booking member. Anything
// other than the literal string "control" (including an unset/unconfigured
// flag) is treated as a variant, so an experiment that hasn't been created
// yet in the PostHog project fails open to today's always-waitlist behavior.
export async function getWaitlistExperimentVariant(
  client: PostHogClient,
  memberId: string,
): Promise<WaitlistExperimentVariant> {
  const value = await client.getFeatureFlag(WAITLIST_EXPERIMENT_FLAG, memberId);
  return value === "control" ? "control" : "variant";
}

// Fires the `waitlist_joined` goal event. Only the member id (as the distinct
// id) and the session id are recorded — no email, name, or other PII.
export async function captureWaitlistJoined(
  client: PostHogClient,
  memberId: string,
  sessionId: string,
): Promise<void> {
  await client.capture({
    distinctId: memberId,
    event: WAITLIST_JOINED_EVENT,
    properties: { sessionId },
  });
}
