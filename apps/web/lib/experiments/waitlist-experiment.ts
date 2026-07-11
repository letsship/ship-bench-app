import type { ExperimentsClient } from "./types";

// The clean PostHog helper: everything the waitlist experiment needs, so the
// booking service never touches an ExperimentsClient's flag/capture calls
// directly.

export const WAITLIST_EXPERIMENT_FLAG_KEY = "waitlist_experiment";

export type WaitlistExperimentGroup = "control" | "variant";

// Resolves a member's group for the waitlist experiment. Anything other than
// the literal "control" flag value — a variant string, `true`, or an
// unevaluated/undefined flag (PostHog unconfigured, outage, etc.) — resolves
// to "variant", preserving today's always-waitlist behavior. A thrown flag
// lookup (network error, PostHog outage) is treated the same as an
// unevaluated flag: a booking must never 500 because analytics is down.
export async function resolveWaitlistExperimentGroup(
  client: ExperimentsClient,
  memberId: string,
): Promise<WaitlistExperimentGroup> {
  try {
    const value = await client.getFlag(WAITLIST_EXPERIMENT_FLAG_KEY, memberId);
    return value === "control" ? "control" : "variant";
  } catch {
    return "variant";
  }
}

// Captures the `waitlist_joined` goal event for a variant-group member who
// was just waitlisted. No PII: only the session id travels in properties.
// The booking has already been committed by this point, so a failed
// analytics write is swallowed rather than failing the request.
export async function recordWaitlistJoined(
  client: ExperimentsClient,
  memberId: string,
  sessionId: string,
): Promise<void> {
  try {
    await client.capture({
      distinctId: memberId,
      event: "waitlist_joined",
      properties: { sessionId },
    });
  } catch {
    // Analytics failure must not fail an already-committed booking.
  }
}
