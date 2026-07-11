import type { ExperimentsClient } from "./types";

// The clean PostHog helper: everything the waitlist experiment needs, so the
// booking service never touches an ExperimentsClient's flag/capture calls
// directly.

export const WAITLIST_EXPERIMENT_FLAG_KEY = "waitlist_experiment";

export type WaitlistExperimentGroup = "control" | "variant";

// Resolves a member's group for the waitlist experiment. Anything other than
// the literal "control" flag value — a variant string, `true`, or an
// unevaluated/undefined flag (PostHog unconfigured, outage, etc.) — resolves
// to "variant", preserving today's always-waitlist behavior.
export async function resolveWaitlistExperimentGroup(
  client: ExperimentsClient,
  memberId: string,
): Promise<WaitlistExperimentGroup> {
  const value = await client.getFlag(WAITLIST_EXPERIMENT_FLAG_KEY, memberId);
  return value === "control" ? "control" : "variant";
}

// Captures the `waitlist_joined` goal event for a variant-group member who
// was just waitlisted. No PII: only the session id travels in properties.
export async function recordWaitlistJoined(
  client: ExperimentsClient,
  memberId: string,
  sessionId: string,
): Promise<void> {
  await client.capture({
    distinctId: memberId,
    event: "waitlist_joined",
    properties: { sessionId },
  });
}
