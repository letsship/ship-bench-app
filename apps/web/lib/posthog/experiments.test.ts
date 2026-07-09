import { describe, expect, it } from "vitest";
import { createFakePostHogClient } from "./fake-client";
import {
  WAITLIST_EXPERIMENT_FLAG,
  captureWaitlistJoined,
  resolveWaitlistExperimentGroup,
} from "./experiments";

describe("resolveWaitlistExperimentGroup", () => {
  it("resolves to control when the flag is exactly 'control'", async () => {
    const client = createFakePostHogClient();
    client.setFeatureFlag(WAITLIST_EXPERIMENT_FLAG, "m1", "control");
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("control");
  });

  it("resolves to variant for any other string value", async () => {
    const client = createFakePostHogClient();
    client.setFeatureFlag(WAITLIST_EXPERIMENT_FLAG, "m1", "test-variant");
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });

  it("resolves to variant for a boolean flag value", async () => {
    const client = createFakePostHogClient();
    client.setFeatureFlag(WAITLIST_EXPERIMENT_FLAG, "m1", true);
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });

  it("defaults to variant when the flag is unset", async () => {
    const client = createFakePostHogClient();
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });

  it("defaults to variant when the flag lookup throws", async () => {
    const client = createFakePostHogClient();
    client.getFeatureFlag = async () => {
      throw new Error("network error");
    };
    expect(await resolveWaitlistExperimentGroup(client, "m1")).toBe("variant");
  });
});

describe("captureWaitlistJoined", () => {
  it("captures the event with the member id as distinct id and only the session id as a property", async () => {
    const client = createFakePostHogClient();
    await captureWaitlistJoined(client, { memberId: "m1", sessionId: "s1" });
    expect(client.captured).toEqual([
      { distinctId: "m1", event: "waitlist_joined", properties: { sessionId: "s1" } },
    ]);
  });
});
