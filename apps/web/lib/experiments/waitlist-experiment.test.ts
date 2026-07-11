import { describe, expect, it } from "vitest";
import { createFakeExperimentsClient } from "./fake-client";
import type { ExperimentsClient } from "./types";
import {
  WAITLIST_EXPERIMENT_FLAG_KEY,
  recordWaitlistJoined,
  resolveWaitlistExperimentGroup,
} from "./waitlist-experiment";

function throwingExperimentsClient(): ExperimentsClient {
  return {
    name: "throwing",
    getFlag: async () => {
      throw new Error("PostHog outage");
    },
    capture: async () => {
      throw new Error("PostHog outage");
    },
  };
}

describe("resolveWaitlistExperimentGroup", () => {
  it("resolves the control flag value to control", async () => {
    const client = createFakeExperimentsClient();
    client.setFlag(WAITLIST_EXPERIMENT_FLAG_KEY, "m1", "control");
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("control");
  });

  it("resolves any variant string to variant", async () => {
    const client = createFakeExperimentsClient();
    client.setFlag(WAITLIST_EXPERIMENT_FLAG_KEY, "m1", "test");
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });

  it("resolves a boolean true value to variant", async () => {
    const client = createFakeExperimentsClient();
    client.setFlag(WAITLIST_EXPERIMENT_FLAG_KEY, "m1", true);
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });

  it("resolves an unevaluated (undefined) flag to variant", async () => {
    const client = createFakeExperimentsClient();
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });

  it("falls back to variant when the flag lookup throws (PostHog outage)", async () => {
    const client = throwingExperimentsClient();
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });
});

describe("recordWaitlistJoined", () => {
  it("captures a waitlist_joined event with only the session id, no PII", async () => {
    const client = createFakeExperimentsClient();
    await recordWaitlistJoined(client, "m1", "s1");
    expect(client.captured).toEqual([
      { distinctId: "m1", event: "waitlist_joined", properties: { sessionId: "s1" } },
    ]);
  });

  it("swallows a capture failure instead of throwing (booking is already committed)", async () => {
    const client = throwingExperimentsClient();
    await expect(recordWaitlistJoined(client, "m1", "s1")).resolves.toBeUndefined();
  });
});
