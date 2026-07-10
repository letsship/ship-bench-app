import type { AnalyticsClient } from "./types";

// The single PostHog helper the booking service calls. Keeps the experiment's
// flag key, group resolution, and goal event shape in one place so domain
// code never sprinkles SDK calls of its own.

export const WAITLIST_EXPERIMENT_FLAG_KEY = "waitlist_experiment";

export type WaitlistExperimentGroup = "control" | "variant";

// Resolves the booking member's group. Only an exact "control" flag value
// turns the member away; anything else — a named variant, a boolean, or a
// flag that can't be evaluated at all — fails open to today's waitlist
// behavior so a PostHog outage never blocks a booking.
export async function getWaitlistExperimentGroup(
  client: AnalyticsClient,
  memberId: string,
): Promise<WaitlistExperimentGroup> {
  try {
    const value = await client.getFlag(memberId, WAITLIST_EXPERIMENT_FLAG_KEY);
    return value === "control" ? "control" : "variant";
  } catch (error) {
    console.error("waitlist_experiment flag evaluation failed", error);
    return "variant";
  }
}

export interface WaitlistJoinedInput {
  memberId: string;
  sessionId: string;
}

// Captures the "waitlist_joined" goal event for a variant member. The
// member's id is the distinct id; properties carry only the session id, no
// personally-identifying data.
export async function recordWaitlistJoined(
  client: AnalyticsClient,
  input: WaitlistJoinedInput,
): Promise<void> {
  await client.capture({
    distinctId: input.memberId,
    event: "waitlist_joined",
    properties: { sessionId: input.sessionId },
  });
}
