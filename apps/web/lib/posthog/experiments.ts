import type { PostHogClient } from "./types";

// Domain-facing PostHog helper: the only place that knows about the
// "waitlist_experiment" flag and the "waitlist_joined" goal event. Domain
// and service code depends only on these functions, never on the flag name
// or raw SDK shapes directly.

export const WAITLIST_EXPERIMENT_FLAG = "waitlist_experiment";

export type WaitlistExperimentGroup = "control" | "variant";

// Normalizes the raw flag value into a group. Any value other than exactly
// "control" (including a missing/false flag, or the lookup failing) is a
// variant, so an unreachable or unconfigured PostHog project doesn't newly
// start turning members away.
export async function resolveWaitlistExperimentGroup(
  client: PostHogClient,
  memberId: string,
): Promise<WaitlistExperimentGroup> {
  try {
    const value = await client.getFeatureFlag(WAITLIST_EXPERIMENT_FLAG, memberId);
    return value === "control" ? "control" : "variant";
  } catch {
    return "variant";
  }
}

export interface WaitlistJoinedInput {
  memberId: string;
  sessionId: string;
}

// Captures the "waitlist_joined" goal event for a variant-group member who
// was just placed on the waitlist. The member id is the distinct id; the
// only property is the class session id — no personally-identifying data.
export async function captureWaitlistJoined(
  client: PostHogClient,
  input: WaitlistJoinedInput,
): Promise<void> {
  await client.capture({
    distinctId: input.memberId,
    event: "waitlist_joined",
    properties: { sessionId: input.sessionId },
  });
}
